'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader, StatStrip, Card, Section, DataTable, StatusBadge, Fields, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { money } from '../lib/data'
import { PARTNERS } from '../lib/dataOps'

const { MUTE, SUB, INK, LINE } = PALETTE

// ── one screen, several entries ───────────────────────────────────────────
//
// The product gives each of these its own route in the sidebar, and this build
// had them behind one entry with tabs. The tabs were already the product's own
// sub-modules, so the content did not need writing — it needed addressing. Each
// entry opens its tab, and walking to the next one moves the tab rather than
// leaving the reader on the screen they have just navigated away from.
const TABS = ['Clients', 'Vendors', 'Billing']

const TAB_FOR_SECTION = {
  'partner-hub': 'Clients',
  'partner-client': 'Clients',
  'partner-vendor': 'Vendors',
  'partner-billing': 'Billing',
}

const TYPE_TONE = { Client: 'violet', Contractor: 'blue', 'Service Provider': 'grey', Supplier: 'green' }

function PartnerCard({ p }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK }}>{p.name}</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTE }}>{p.contact_name} · {p.email}</p>
        </div>
        <StatusBadge>{p.status}</StatusBadge>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 13 }}>
        <StatusBadge tone={TYPE_TONE[p.type]}>{p.type}</StatusBadge>
        {p.jobs_open > 0 && <StatusBadge tone="amber">{p.jobs_open} open</StatusBadge>}
      </div>

      <div style={{ paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
        <Fields columns={2} rows={[
          ['Open jobs', p.jobs_open],
          ['Completed', p.jobs_done],
          ['Service level', p.sla],
          [p.type === 'Client' ? 'Billed' : 'Spend', money(p.spend)],
        ]} />
      </div>
    </Card>
  )
}

function CardGrid({ rows, empty }) {
  if (!rows.length) {
    return <Card><div style={{ padding: '34px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>{empty}</div></Card>
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px, 100%),1fr))', gap: 14 }}>
      {rows.map((p) => <PartnerCard key={p.partner_id} p={p} />)}
    </div>
  )
}

export default function PartnerHub({ section }) {
  const [tab, setTab] = useState(TAB_FOR_SECTION[section] || 'Clients')

  // Walking from one entry to the next moves the tab. Without it the route
  // changes and the screen does not, which reads as a menu item that does
  // nothing.
  useEffect(() => {
    const wanted = TAB_FOR_SECTION[section]
    if (wanted) setTab(wanted)
  }, [section])

  // Partners are organisation-level, like vendors: a contract is signed by the
  // company, not by one plant, so this screen deliberately ignores the site
  // filter rather than pretending a client belongs to Sheffield.
  const clients = useMemo(() => PARTNERS.filter((p) => p.type === 'Client'), [])
  const suppliers = useMemo(() => PARTNERS.filter((p) => p.type !== 'Client'), [])

  const billed = clients.reduce((n, p) => n + p.spend, 0)
  const spent = suppliers.reduce((n, p) => n + p.spend, 0)
  const totalSpend = PARTNERS.reduce((n, p) => n + p.spend, 0)

  const columns = [
    { key: 'name', label: 'Partner', render: (p) => <span style={{ fontWeight: 700, color: '#15227a' }}>{p.name}</span> },
    { key: 'type', label: 'Type', render: (p) => <StatusBadge tone={TYPE_TONE[p.type]}>{p.type}</StatusBadge> },
    { key: 'contact_name', label: 'Contact' },
    { key: 'sla', label: 'Service level' },
    { key: 'jobs_open', label: 'Open', align: 'right', render: (p) => (p.jobs_open ? <span style={{ fontWeight: 700, color: '#b45309' }}>{p.jobs_open}</span> : '—') },
    { key: 'jobs_done', label: 'Completed', align: 'right' },
    { key: 'spend', label: 'Value', align: 'right', render: (p) => <span style={{ fontWeight: 700 }}>{money(p.spend)}</span> },
    {
      key: 'share', label: 'Share', align: 'right', sortValue: (p) => p.spend,
      render: (p) => `${totalSpend ? Math.round((p.spend / totalSpend) * 100) : 0}%`,
    },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge>{p.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('partner-hub', '#15227a')}
        title="Partner Hub"
        subtitle={`${PARTNERS.length} clients, contractors and suppliers · organisation-wide`}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            borderRadius: 9, border: `1px solid ${tab === t ? '#15227a' : LINE}`,
            background: tab === t ? '#15227a' : '#fff', color: tab === t ? '#fff' : SUB,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Clients' && (
        <>
          <StatStrip items={[
            { label: 'Clients', value: clients.length },
            { label: 'Open jobs', value: clients.reduce((n, p) => n + p.jobs_open, 0), tone: 'amber' },
            { label: 'Jobs completed', value: clients.reduce((n, p) => n + p.jobs_done, 0), tone: 'green' },
            { label: 'Billed to date', value: money(billed) },
          ]} />
          <CardGrid rows={clients} empty="No clients are set up yet." />
        </>
      )}

      {tab === 'Vendors' && (
        <>
          <StatStrip items={[
            { label: 'Vendors', value: suppliers.length },
            { label: 'Contractors', value: suppliers.filter((p) => p.type === 'Contractor').length },
            { label: 'Open jobs', value: suppliers.reduce((n, p) => n + p.jobs_open, 0), tone: 'amber' },
            { label: 'Spend to date', value: money(spent) },
          ]} />
          <CardGrid rows={suppliers} empty="No vendors are set up yet." />
        </>
      )}

      {tab === 'Billing' && (
        <>
          <StatStrip items={[
            { label: 'Partners', value: PARTNERS.length },
            { label: 'Billed to clients', value: money(billed), tone: 'green' },
            { label: 'Paid to vendors', value: money(spent) },
            { label: 'Open jobs', value: PARTNERS.reduce((n, p) => n + p.jobs_open, 0), tone: 'amber' },
          ]} />
          <Section title="Spend by partner"
            right={<span style={{ fontSize: 11.5, color: MUTE }}>{money(totalSpend)} across all partners</span>}>
            <DataTable columns={columns} rows={PARTNERS} pageSize={10} empty="No partner billing to show." />
          </Section>
        </>
      )}
    </div>
  )
}
