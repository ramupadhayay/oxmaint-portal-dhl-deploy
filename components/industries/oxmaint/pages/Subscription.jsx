'use client'

import { PageHeader, StatStrip, Card, Section, Fields, StatusBadge, Bar, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { ORG, ASSETS, TECHNICIANS, SITES, fmtDate, daysUntil, money } from '../lib/data'

const { MUTE, SUB, INK, LINE, GREEN, AMBER, RED } = PALETTE

const usageColor = (pct) => (pct >= 90 ? RED : pct >= 70 ? AMBER : GREEN)

const PLANS = [
  { name: 'Starter', price: 0, users: 5, assets: 50, features: ['Work orders', 'Assets', 'Basic reports'] },
  { name: 'Professional', price: 39, users: 20, assets: 200, features: ['Everything in Starter', 'PM schedules', 'Inventory', 'Inspections'] },
  { name: 'Enterprise', price: 79, users: 50, assets: 500, features: ['Everything in Professional', 'Integrations', 'Shutdown planning', 'SSO & audit'] },
]

export default function Subscription() {
  const userPct = Math.round((TECHNICIANS.length / ORG.max_users) * 100)
  const assetPct = Math.round((ASSETS.length / ORG.max_assets) * 100)
  const renews = daysUntil(ORG.subscription_expiry)

  return (
    <div>
      <PageHeader
        icon={sectionIcon('subscription', '#15227a')}
        title="Subscription"
        subtitle={`${ORG.subscription_plan} plan · renews in ${renews} days`}
        right={<ActionButton variant="ghost" onClick={() => {}}>Manage billing</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Plan', value: ORG.subscription_plan },
        { label: 'Status', value: ORG.subscription_status, tone: 'green' },
        { label: 'Seats used', value: `${TECHNICIANS.length}/${ORG.max_users}` },
        { label: 'Assets used', value: `${ASSETS.length}/${ORG.max_assets}` },
        { label: 'Renews', value: fmtDate(ORG.subscription_expiry) },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px, 100%),1fr))', gap: 14 }}>
        <Section title="Usage against your plan">
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: SUB, fontWeight: 600 }}>Users</span>
              <span style={{ fontWeight: 800, color: usageColor(userPct) }}>{TECHNICIANS.length} of {ORG.max_users}</span>
            </div>
            <Bar pct={userPct} color={usageColor(userPct)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: SUB, fontWeight: 600 }}>Assets</span>
              <span style={{ fontWeight: 800, color: usageColor(assetPct) }}>{ASSETS.length} of {ORG.max_assets}</span>
            </div>
            <Bar pct={assetPct} color={usageColor(assetPct)} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: SUB, fontWeight: 600 }}>Sites</span>
              <span style={{ fontWeight: 800, color: GREEN }}>{SITES.length} · unlimited</span>
            </div>
            <Bar pct={100} color={GREEN} />
          </div>
        </Section>

        <Section title="Billing">
          <Fields rows={[
            ['Plan', ORG.subscription_plan],
            ['Status', ORG.subscription_status],
            ['Seats', `${ORG.max_users} included`],
            ['Rate', `${money(79)} per user / month`],
            ['Monthly total', money(79 * TECHNICIANS.length)],
            ['Next invoice', fmtDate(ORG.subscription_expiry)],
            ['Currency', ORG.currency],
            ['Customer since', fmtDate(ORG.created_date)],
          ]} />
        </Section>
      </div>

      <Section title="Plans">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          {PLANS.map((p) => {
            const current = p.name === ORG.subscription_plan
            return (
              <div key={p.name} style={{
                border: `1px solid ${current ? '#15227a' : LINE}`, borderRadius: 12, padding: 16,
                background: current ? '#f7f8ff' : '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{p.name}</span>
                  {current && <StatusBadge tone="blue">Current</StatusBadge>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
                  <span style={{ fontSize: 25, fontWeight: 800, color: INK }}>{p.price ? money(p.price) : 'Free'}</span>
                  {p.price > 0 && <span style={{ fontSize: 11.5, color: MUTE }}>/user/month</span>}
                </div>
                <div style={{ fontSize: 11.5, color: SUB, marginBottom: 10 }}>{p.users} users · {p.assets} assets</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: 'flex', gap: 7, fontSize: 12, color: SUB }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="m5 12 5 5L20 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
