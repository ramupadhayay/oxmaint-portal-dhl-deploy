'use client'

import { useState } from 'react'
import { PageHeader, Card, Section, Fields, StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { sectionIcon, MENU } from '../lib/nav'
import { useVisibility } from '../lib/visibility'
import { ORG, USER } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

export default function Settings() {
  const [prefs, setPrefs] = useState({
    date_format: 'DD/MM/YYYY',
    time_format: '24-hour',
    week_start: 'Monday',
    measurement: 'Metric',
    currency: ORG.currency,
    timezone: ORG.timezone,
  })

  const [notify, setNotify] = useState({
    wo_assigned: true,
    wo_overdue: true,
    pm_due: true,
    stock_low: true,
    inspection_failed: true,
    weekly_digest: false,
  })

  // Module visibility is stored, not local: a toggle that forgets itself on
  // navigation is the fastest way to teach an audience the setting is fake.
  const { isHidden, toggle: toggleModule, showAll, hidden } = useVisibility()

  return (
    <div>
      <PageHeader
        icon={sectionIcon('settings', '#15227a')}
        title="Settings"
        subtitle={`Preferences for ${ORG.organization_name}`}
        right={<ActionButton onClick={() => {}}>Save changes</ActionButton>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px, 100%),1fr))', gap: 14 }}>
        <Section title="Regional">
          {[
            ['Date format', 'date_format', ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']],
            ['Time format', 'time_format', ['24-hour', '12-hour']],
            ['Week starts', 'week_start', ['Monday', 'Sunday']],
            ['Measurement', 'measurement', ['Metric', 'Imperial']],
          ].map(([label, key, options]) => (
            <div key={key} style={row}>
              <span style={{ fontSize: 12.5, color: SUB, fontWeight: 600 }}>{label}</span>
              <select value={prefs[key]} onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.value }))} style={select}>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div style={{ ...row, borderBottom: 'none' }}>
            <span style={{ fontSize: 12.5, color: SUB, fontWeight: 600 }}>Currency & time zone</span>
            <span style={{ fontSize: 12.5, color: INK, fontWeight: 600 }}>{prefs.currency} · {prefs.timezone}</span>
          </div>
        </Section>

        <Section title="Notifications">
          {[
            ['Work order assigned to me', 'wo_assigned'],
            ['Work order goes overdue', 'wo_overdue'],
            ['Preventive maintenance due', 'pm_due'],
            ['Part falls below reorder point', 'stock_low'],
            ['Inspection fails', 'inspection_failed'],
            ['Weekly summary email', 'weekly_digest'],
          ].map(([label, key]) => (
            <div key={key} style={row}>
              <span style={{ fontSize: 12.5, color: SUB, fontWeight: 600 }}>{label}</span>
              <Toggle on={notify[key]} onClick={() => setNotify((p) => ({ ...p, [key]: !p[key] }))} />
            </div>
          ))}
        </Section>
      </div>

      <Section title="Modules"
        right={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: MUTE }}>{MENU.length - hidden.length} of {MENU.length} shown in the menu</span>
            {hidden.length > 0 && (
              <button onClick={showAll} style={{ background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Show all
              </button>
            )}
          </span>
        }>
        <p style={{ margin: '0 0 13px', fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
          Turn off what this organisation does not use. Hidden modules disappear from the sidebar
          but keep their data, so nothing is lost by switching one off to try it.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 9 }}>
          {MENU.map((g) => (
            <button key={g.key} onClick={() => toggleModule(g.key)} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', textAlign: 'left',
              border: `1px solid ${!isHidden(g.key) ? '#15227a' : LINE}`, borderRadius: 10,
              background: !isHidden(g.key) ? '#f7f8ff' : '#fff', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Toggle on={!isHidden(g.key)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: INK }}>{g.label}</span>
                <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{g.children ? g.children.length : 1} screen{g.children && g.children.length > 1 ? 's' : ''}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(330px, 100%),1fr))', gap: 14 }}>
        <Section title="Your account">
          <Fields rows={[
            ['Name', USER.name],
            ['Email', USER.email],
            ['Mobile', USER.mobile],
            ['Role', USER.role_name],
            ['Organisation', ORG.organization_name],
          ]} />
        </Section>
        <Section title="Security">
          <div style={row}>
            <span style={{ fontSize: 12.5, color: SUB, fontWeight: 600 }}>Single sign-on</span>
            <StatusBadge>Connected</StatusBadge>
          </div>
          <div style={row}>
            <span style={{ fontSize: 12.5, color: SUB, fontWeight: 600 }}>Two-factor authentication</span>
            <StatusBadge tone="amber">Optional</StatusBadge>
          </div>
          <div style={{ ...row, borderBottom: 'none' }}>
            <span style={{ fontSize: 12.5, color: SUB, fontWeight: 600 }}>Audit log</span>
            <StatusBadge>Active</StatusBadge>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Toggle({ on, onClick }) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        width: 34, height: 19, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: on ? '#15227a' : '#cbd5e1', cursor: onClick ? 'pointer' : 'default', transition: 'background .15s',
      }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: '50%',
        background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(15,23,42,0.2)',
      }} />
    </span>
  )
}

const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${LINE}` }
const select = {
  padding: '6px 9px', fontSize: 12.5, fontWeight: 600, color: '#15227a', background: '#fff',
  border: `1px solid ${LINE}`, borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}
