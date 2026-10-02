'use client'

import { PageHeader, StatStrip, Card, Section, Fields, StatusBadge, HBars, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import LogoUploadCard from '../components/LogoUploadCard'
import { ORG, SITES, ASSETS, TECHNICIANS, WORK_ORDERS, PARTS, fmtDate, money, KPI } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

export default function Organization() {
  return (
    <div>
      <PageHeader
        icon={sectionIcon('organization', '#15227a')}
        title="Organization Details"
        subtitle={`${ORG.organization_name} · ${ORG.organization_code}`}
        right={<ActionButton variant="ghost" onClick={() => {}}>Edit details</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Sites', value: SITES.length },
        { label: 'Assets', value: ASSETS.length },
        { label: 'Members', value: TECHNICIANS.length },
        { label: 'Work orders', value: WORK_ORDERS.length },
        { label: 'Stock value', value: money(KPI.inventory_value) },
      ]} />

      <LogoUploadCard />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px, 100%),1fr))', gap: 14 }}>
        <Section title="Company">
          <div style={{ display: 'flex', gap: 13, alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${LINE}` }}>
            <div style={logo}>{ORG.organization_code}</div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: INK }}>{ORG.organization_name}</div>
              <div style={{ fontSize: 12, color: MUTE, marginTop: 2 }}>{ORG.industry} · customer since {fmtDate(ORG.created_date)}</div>
            </div>
          </div>
          <Fields rows={[
            ['Organisation code', ORG.organization_code],
            ['Industry', ORG.industry],
            ['Address', ORG.address],
            ['City', ORG.city],
            ['Country', ORG.country],
            ['Time zone', ORG.timezone],
            ['Currency', ORG.currency],
            ['Plan', ORG.subscription_plan],
          ]} />
        </Section>

        <Section title="Sites">
          {SITES.map((s) => {
            const assets = ASSETS.filter((a) => a.site_id === s.site_id).length
            return (
              <div key={s.site_id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: `1px solid ${LINE}` }}>
                <div style={siteChip}>{s.code}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{s.site_name}</div>
                  <div style={{ fontSize: 11.5, color: MUTE }}>{s.city}, {s.country}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{assets}</div>
                  <div style={{ fontSize: 10.5, color: MUTE }}>assets</div>
                </div>
                {s.is_default && <StatusBadge tone="blue">Default</StatusBadge>}
              </div>
            )
          })}
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(340px, 100%),1fr))', gap: 14 }}>
        <Section title="Assets by site">
          <HBars data={SITES.map((s) => ({ name: s.site_name, value: ASSETS.filter((a) => a.site_id === s.site_id).length }))} />
        </Section>
        <Section title="Usage against plan">
          <HBars data={[
            { name: `Users (${TECHNICIANS.length} of ${ORG.max_users})`, value: Math.round((TECHNICIANS.length / ORG.max_users) * 100), color: '#3b82f6' },
            { name: `Assets (${ASSETS.length} of ${ORG.max_assets})`, value: Math.round((ASSETS.length / ORG.max_assets) * 100), color: '#15227a' },
            { name: `Parts catalogue (${PARTS.length})`, value: 100, color: '#10b981' },
          ]} unit="%" />
          <p style={{ margin: '13px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.5 }}>
            {ORG.subscription_plan} plan, renews {fmtDate(ORG.subscription_expiry)}.
          </p>
        </Section>
      </div>
    </div>
  )
}

const logo = {
  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
  background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff',
  fontSize: 14, fontWeight: 800, letterSpacing: 0.5,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const siteChip = {
  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
  background: '#e8ecff', color: '#15227a', fontSize: 11.5, fontWeight: 800,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
