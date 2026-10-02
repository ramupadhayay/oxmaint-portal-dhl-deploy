'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Toolbar, DataTable, Drawer, Fields, Section, StatusBadge, Donut, BarPairs, HBars, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { INCIDENTS, WORK_PERMITS, BY_STATUS, fmtDate, daysUntil } from '../lib/data'
// CERT_TYPES comes from the register rather than being listed here, because a
// pack can name its own certificates and a filter offering LOLER on a register
// that holds none would filter to nothing.
import { CERTIFICATES, LOTOTO, CLEARANCES, EHS_TREND, CERT_TYPES } from '../lib/dataEhs'

const { ACCENT, MUTE, SUB, INK, LINE, RED, AMBER } = PALETTE

const TABS = ['Dashboard', 'Certificates', 'LOTOTO', 'Clearances']

// The kit's status table speaks maintenance, not EHS, so every word below would
// come back neutral grey — and a grey "Expired" against a lifting examination is
// the one thing this screen must never render.
const CERT_TONE = { Valid: 'green', 'Expiring Soon': 'amber', Expired: 'red' }
const CLEARANCE_TONE = { Issued: 'blue', 'Work in Progress': 'amber', 'Returned to Service': 'green' }

const EXPIRY_INK = { Expired: '#b91c1c', 'Expiring Soon': '#b45309' }

export default function Ehs() {
  const { scope, siteName } = useSite()
  const [tab, setTab] = useState('Dashboard')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [cert, setCert] = useState(null)
  const [loto, setLoto] = useState(null)

  // The filters are per-tab to the person reading them, so they are cleared on
  // the way out. A type filter carried over from Certificates would hide most of
  // the LOTOTO register with nothing on screen to explain why.
  const go = (t) => {
    setTab(t)
    setSearch('')
    setType('all')
    setStatus('all')
  }

  const d = useMemo(() => {
    const incidents = scope(INCIDENTS)
    return {
      incidents,
      certs: scope(CERTIFICATES),
      lotos: scope(LOTOTO),
      clears: scope(CLEARANCES),
      permits: scope(WORK_PERMITS),
      recent: [...incidents].sort((a, b) => new Date(b.reported_date) - new Date(a.reported_date)).slice(0, 6),
      // BY_STATUS orders by first appearance, so under a site filter the first
      // colour could land on Low and the chart would paint the mildest incidents
      // red. Severity is ordered here and the palette follows that order.
      severity: ['High', 'Medium', 'Low']
        .map((name) => ({ name, value: incidents.filter((i) => i.severity === name).length }))
        .filter((s) => s.value),
    }
  }, [scope])

  const certRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return d.certs.filter((c) => (
      (type === 'all' || c.certificate_type === type) &&
      (status === 'all' || c.status === status) &&
      (!q || [c.reference, c.certificate_type, c.asset_name, c.asset_code, c.issued_by].join(' ').toLowerCase().includes(q))
    ))
  }, [d.certs, search, type, status])

  const lotoRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return d.lotos.filter((p) => (
      (status === 'all' || p.status === status) &&
      (!q || [p.asset_name, p.asset_code, p.verified_by_name, ...p.energy_sources].join(' ').toLowerCase().includes(q))
    ))
  }, [d.lotos, search, status])

  const assetCell = (r) => (
    <div>
      <div style={{ fontWeight: 600 }}>{r.asset_name}</div>
      <div style={{ fontSize: 11, color: MUTE }}>{r.asset_code}</div>
    </div>
  )

  const certColumns = [
    { key: 'reference', label: 'Reference', render: (r) => <span style={{ fontWeight: 700, color: ACCENT }}>{r.reference}</span> },
    { key: 'certificate_type', label: 'Type' },
    { key: 'asset_name', label: 'Asset', render: assetCell },
    { key: 'issued_by', label: 'Issued by' },
    {
      key: 'expiry_date', label: 'Expiry', sortValue: (r) => new Date(r.expiry_date).getTime(),
      render: (r) => {
        const days = daysUntil(r.expiry_date)
        return (
          <span style={{ whiteSpace: 'nowrap', color: EXPIRY_INK[r.status] || INK, fontWeight: EXPIRY_INK[r.status] ? 700 : 500 }}>
            {fmtDate(r.expiry_date)}
            {r.status === 'Expired' && ` · ${Math.abs(days)} d ago`}
            {r.status === 'Expiring Soon' && ` · in ${days} d`}
          </span>
        )
      },
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={CERT_TONE[r.status]}>{r.status}</StatusBadge> },
  ]

  const lotoColumns = [
    { key: 'asset_name', label: 'Asset', render: assetCell },
    {
      key: 'energy_sources', label: 'Energy sources', align: 'right', sortValue: (r) => r.energy_sources.length,
      render: (r) => r.energy_sources.length,
    },
    { key: 'isolation_points', label: 'Isolation points', align: 'right' },
    { key: 'steps', label: 'Steps', align: 'right' },
    {
      key: 'last_verified', label: 'Last verified', sortValue: (r) => new Date(r.last_verified).getTime(),
      render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.last_verified)}</span>,
    },
    { key: 'verified_by_name', label: 'Verified by' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
  ]

  const clearanceColumns = [
    { key: 'clearance_number', label: 'Clearance', render: (r) => <span style={{ fontWeight: 700, color: ACCENT }}>{r.clearance_number}</span> },
    { key: 'work_order_number', label: 'Work order' },
    { key: 'asset_name', label: 'Asset' },
    { key: 'isolated_by_name', label: 'Isolated by' },
    { key: 'accepted_by_name', label: 'Accepted by' },
    {
      key: 'issued', label: 'Issued', sortValue: (r) => new Date(r.issued).getTime(),
      render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.issued)}</span>,
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={CLEARANCE_TONE[r.status]}>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('ehs', '#15227a')}
        title="EHS"
        subtitle={`Environment, health and safety · ${siteName}`}
        right={<ActionButton variant="ghost" onClick={() => window.print()}>Export PDF</ActionButton>}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => go(t)} style={{
            padding: '7px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            borderRadius: 9, border: `1px solid ${tab === t ? '#15227a' : LINE}`,
            background: tab === t ? '#15227a' : '#fff', color: tab === t ? '#fff' : SUB,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <>
          <StatStrip items={[
            { label: 'Open incidents', value: d.incidents.filter((i) => i.status !== 'Closed').length, tone: 'red' },
            { label: 'Lost-time incidents', value: d.incidents.filter((i) => i.lost_time).length, tone: 'red' },
            { label: 'Near misses', value: EHS_TREND.reduce((n, m) => n + m.near_misses, 0), note: 'Last 12 months' },
            { label: 'Active permits', value: d.permits.filter((p) => p.status === 'Active').length },
            { label: 'Certificates expiring', value: d.certs.filter((c) => c.status === 'Expiring Soon').length, tone: 'amber', note: 'Within 30 days' },
          ]} />

          <Section title="Near misses and incidents — 12 months">
            <BarPairs data={EHS_TREND} keys={['near_misses', 'incidents']} labels={['Near misses', 'Incidents']} colors={[ACCENT, RED]} />
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px, 100%),1fr))', gap: 14 }}>
            <Section title="Incident severity">
              <Donut data={d.severity} colors={[RED, AMBER, '#94a3b8']} />
            </Section>
            <Section title="Incidents by site">
              <HBars data={BY_STATUS(d.incidents, 'site_name')} />
            </Section>
          </div>

          <Section title="Most recent incidents">
            <DataTable pageSize={6} rows={d.recent} empty="No incidents recorded at this site."
              columns={[
                { key: 'incident_number', label: 'Ref', render: (r) => <span style={{ fontWeight: 700, color: ACCENT }}>{r.incident_number}</span> },
                { key: 'title', label: 'Incident' },
                { key: 'severity', label: 'Severity', sortValue: (r) => ['High', 'Medium', 'Low'].indexOf(r.severity), render: (r) => <StatusBadge>{r.severity}</StatusBadge> },
                { key: 'site_name', label: 'Site' },
                { key: 'reported_date', label: 'Reported', sortValue: (r) => new Date(r.reported_date).getTime(), render: (r) => fmtDate(r.reported_date) },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge>{r.status}</StatusBadge> },
              ]} />
          </Section>
        </>
      )}

      {tab === 'Certificates' && (
        <>
          <StatStrip items={[
            { label: 'Certificates', value: d.certs.length },
            { label: 'Valid', value: d.certs.filter((c) => c.status === 'Valid').length, tone: 'green' },
            { label: 'Expiring soon', value: d.certs.filter((c) => c.status === 'Expiring Soon').length, tone: 'amber' },
            { label: 'Expired', value: d.certs.filter((c) => c.status === 'Expired').length, tone: 'red' },
          ]} />

          <Toolbar
            search={search} onSearch={setSearch}
            placeholder="Search reference, type, asset, issuer…"
            filters={[
              { label: 'Type', value: type, onChange: setType, options: CERT_TYPES },
              { label: 'Status', value: status, onChange: setStatus, options: ['Valid', 'Expiring Soon', 'Expired'] },
            ]}
            right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{certRows.length} shown</span>}
          />

          <DataTable columns={certColumns} rows={certRows} onRowClick={setCert} pageSize={10} empty="No certificates match these filters." />
        </>
      )}

      {tab === 'LOTOTO' && (
        <>
          <StatStrip items={[
            { label: 'Procedures', value: d.lotos.length },
            { label: 'Approved', value: d.lotos.filter((p) => p.status === 'Approved').length, tone: 'green' },
            { label: 'Under review', value: d.lotos.filter((p) => p.status === 'Under Review').length, tone: 'amber' },
            { label: 'Isolation points', value: d.lotos.reduce((n, p) => n + p.isolation_points, 0) },
            { label: 'Energy sources', value: d.lotos.reduce((n, p) => n + p.energy_sources.length, 0) },
          ]} />

          <Toolbar
            search={search} onSearch={setSearch}
            placeholder="Search asset, energy source, verifier…"
            filters={[
              { label: 'Status', value: status, onChange: setStatus, options: ['Approved', 'Under Review'] },
            ]}
            right={<span style={{ fontSize: 11.5, color: MUTE, alignSelf: 'center' }}>{lotoRows.length} shown</span>}
          />

          <DataTable columns={lotoColumns} rows={lotoRows} onRowClick={setLoto} pageSize={10} empty="No procedures match these filters." />
        </>
      )}

      {tab === 'Clearances' && (
        <>
          <StatStrip items={[
            { label: 'Clearances', value: d.clears.length },
            { label: 'Issued', value: d.clears.filter((c) => c.status === 'Issued').length, tone: 'blue' },
            { label: 'Work in progress', value: d.clears.filter((c) => c.status === 'Work in Progress').length, tone: 'amber' },
            { label: 'Returned to service', value: d.clears.filter((c) => c.status === 'Returned to Service').length, tone: 'green' },
          ]} />

          <DataTable columns={clearanceColumns} rows={d.clears} pageSize={12} empty="No safety clearances are open at this site." />
        </>
      )}

      <Drawer open={Boolean(cert)} onClose={() => setCert(null)} title={cert?.reference} subtitle={cert?.certificate_type}
        icon={sectionIcon('certificates', '#15227a')}>
        {cert && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <StatusBadge tone={CERT_TONE[cert.status]}>{cert.status}</StatusBadge>
            <Fields rows={[
              ['Asset', cert.asset_name],
              ['Asset code', cert.asset_code],
              ['Site', cert.site_name],
              ['Issued by', cert.issued_by],
              ['Issued', fmtDate(cert.issued_date)],
              ['Expires', fmtDate(cert.expiry_date)],
            ]} />
          </div>
        )}
      </Drawer>

      <Drawer open={Boolean(loto)} onClose={() => setLoto(null)} title={loto?.asset_name} subtitle={`LOTOTO procedure · ${loto?.asset_code || ''}`}
        icon={sectionIcon('lototo', '#15227a')}>
        {loto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <StatusBadge>{loto.status}</StatusBadge>
            <Fields rows={[
              ['Site', loto.site_name],
              ['Isolation points', loto.isolation_points],
              ['Steps', loto.steps],
              ['Last verified', fmtDate(loto.last_verified)],
              ['Verified by', loto.verified_by_name],
            ]} />
            {/* The count in the table says how big the job is; only the list says
                what to isolate, and that is the whole reason the procedure exists. */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                Energy sources to isolate
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {loto.energy_sources.map((source, i) => (
                  <div key={source} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                    border: `1px solid ${LINE}`, borderRadius: 9, background: '#f8fafc',
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, background: '#e8ecff', color: ACCENT,
                      fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 12.5, color: INK, fontWeight: 500 }}>{source}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
