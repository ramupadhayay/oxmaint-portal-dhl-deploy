'use client'

// One asset, on its own page.
//
// The register is six hundred rows because every suite carries six appliances,
// so the useful question about any one of them is never "what are its fields" —
// it is "has this thing been trouble". That is its history, which is the part a
// drawer had no room for: it showed six jobs and stopped.
//
// Work orders come from `useWorkOrders`, not the generated list, so a job closed
// on the schedule this morning shows closed against the asset too.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Fields, DataTable,
  StatusBadge, Priority, ActionButton, Donut, PALETTE,
} from '../lib/kit'
import { useWorkOrders } from '../lib/live'
import { ASSETS, fmtDate, isPast, daysUntil, money, isOpen } from '../lib/data'

const { ACCENT, INK, SUB, MUTE } = PALETTE

const critTone = (c) => (c === 'High' ? 'red' : c === 'Medium' ? 'amber' : 'grey')
const healthTone = (n) => (n >= 85 ? 'green' : n >= 70 ? 'amber' : 'red')

// The order a person reads a backlog in, not alphabetical: what is live first,
// what is finished last.
const STATUS_ORDER = ['Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled']

export default function AssetView({ section, id }) {
  const router = useRouter()
  const workOrders = useWorkOrders()

  const asset = useMemo(() => ASSETS.find((a) => a.asset_id === String(id)) || null, [id])

  const wos = useMemo(
    () => (asset ? workOrders.filter((w) => w.asset_id === asset.asset_id) : []),
    // `workOrders` is a hook result: left out of the deps, this list would keep
    // drawing the backlog as it was on first render and a job closed elsewhere
    // would still read Open here.
    [workOrders, asset]
  )

  if (!asset) return <NotHere reference={id} router={router} />

  const open = wos.filter(isOpen)
  const spend = wos.reduce((n, w) => n + (w.total_cost || 0), 0)
  const overdueService = isPast(asset.next_maintenance_date)
  const dueDays = daysUntil(asset.next_maintenance_date)

  const mix = STATUS_ORDER
    .map((s) => ({ name: s, value: wos.filter((w) => w.status === s).length }))
    .filter((d) => d.value)

  const columns = [
    { key: 'work_order_number', label: 'Number', render: (r) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, color: ACCENT, fontWeight: 700 }}>{r.work_order_number}</span> },
    { key: 'title', label: 'Job', render: (r) => <span style={{ color: INK }}>{r.title}</span> },
    { key: 'work_order_type', label: 'Type' },
    { key: 'priority', label: 'Priority', render: (r) => <Priority value={r.priority} /> },
    { key: 'assigned_to_name', label: 'Assigned' },
    { key: 'created_date', label: 'Raised', render: (r) => fmtDate(r.created_date), sortValue: (r) => new Date(r.created_date).getTime() },
    { key: 'total_cost', label: 'Cost', align: 'right', render: (r) => money(r.total_cost), sortValue: (r) => r.total_cost },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeading
        title={asset.asset_name}
        subtitle={`${asset.asset_type} · ${asset.location_name}${asset.in_suite ? '' : ' · plant the whole property depends on'}`}
        back={{ label: 'Assets', onClick: () => router.push('/portal/hospitality/assets') }}
        right={asset.suite_number ? (
          <ActionButton variant="ghost" onClick={() => router.push(`/portal/hospitality/suites/${asset.suite_number}`)}>
            Open Suite {asset.suite_number}
          </ActionButton>
        ) : null}
      />

      <StatCards items={[
        {
          label: 'Health score',
          value: asset.health_score,
          unit: '%',
          tone: healthTone(asset.health_score),
          note: asset.status,
        },
        {
          label: 'Criticality',
          value: asset.criticality,
          tone: asset.criticality === 'High' ? 'red' : asset.criticality === 'Medium' ? 'amber' : undefined,
          note: asset.in_suite ? 'one of ninety-eight' : 'one of a kind on site',
        },
        {
          label: 'Open work orders',
          value: open.length,
          tone: open.length ? 'amber' : 'green',
          note: `${wos.length} in its history`,
        },
        {
          label: overdueService ? 'Service overdue by' : 'Next service in',
          value: Math.abs(dueDays),
          unit: 'days',
          tone: overdueService ? 'red' : 'blue',
          note: fmtDate(asset.next_maintenance_date),
        },
      ]} />

      <div style={styles.two}>
        <Section title="What it is" style={{ marginBottom: 0 }}>
          <Fields rows={[
            ['Code', <span key="c" style={styles.mono}>{asset.asset_code}</span>],
            ['Type', asset.asset_type],
            ['Status', <StatusBadge key="s">{asset.status}</StatusBadge>],
            ['Criticality', <StatusBadge key="k" tone={critTone(asset.criticality)}>{asset.criticality}</StatusBadge>],
            ['Manufacturer', asset.manufacturer],
            ['Model', asset.model],
            ['Serial', <span key="n" style={styles.mono}>{asset.serial_number}</span>],
            ['Health score', `${asset.health_score}%`],
          ]} />
        </Section>

        <Section title="Where it lives" style={{ marginBottom: 0 }}>
          <Fields rows={[
            ['Location', asset.location_name],
            ['Suite', asset.suite_number || 'Back of house'],
            ['Scope', asset.in_suite ? 'In suite' : 'Plant'],
            ['Last maintained', fmtDate(asset.last_maintenance_date)],
            ['Next due', fmtDate(asset.next_maintenance_date)],
            ['Lifetime spend', money(spend)],
          ]} />

          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
            {asset.in_suite
              ? 'In-suite equipment is maintained on the quarterly suite rotation rather than on its own schedule — the whole suite is walked at once, because sending a tech to one appliance and back is the cost, not the work.'
              : 'Plant is scheduled on its own interval. There is one of it, so an outage is the property’s outage rather than one room out of service.'}
          </p>

          {asset.suite_number && (
            <button
              onClick={() => router.push(`/portal/hospitality/suites/${asset.suite_number}`)}
              style={styles.linkBtn}
            >
              Open Suite {asset.suite_number} →
            </button>
          )}
        </Section>
      </div>

      {mix.length > 0 && (
        <Section
          title="How its work has gone"
          right={<span style={{ fontSize: 11.5, color: MUTE }}>{money(spend)} spent across {wos.length} job{wos.length === 1 ? '' : 's'}</span>}
        >
          <Donut data={mix} size={150} thickness={24} />
        </Section>
      )}

      <Section
        title="Work order history"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>{open.length} still open</span>}
      >
        <DataTable
          columns={columns}
          rows={wos.map((w) => ({ ...w, id: w.workorder_id || w.recordId }))}
          pageSize={10}
          onRowClick={(r) => router.push(`/portal/hospitality/work-orders/${r.workorder_id || r.recordId}`)}
          empty="Nothing has ever been raised against this asset."
        />
      </Section>
    </div>
  )
}

function NotHere({ reference, router }) {
  return (
    <Card style={{ maxWidth: 560 }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>Nothing here with that reference</h1>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: SUB, lineHeight: 1.6 }}>
        <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{String(reference)}</code> is not
        an asset in this register.
      </p>
      <div style={{ marginTop: 16 }}>
        <ActionButton onClick={() => router.push('/portal/hospitality/assets')}>Back to the assets</ActionButton>
      </div>
    </Card>
  )
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
  mono: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: SUB },
  linkBtn: {
    marginTop: 14, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${ACCENT}33`, color: ACCENT, borderRadius: 7, cursor: 'pointer',
  },
}
