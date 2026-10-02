'use client'

// Biometrics — attendance against the work actually booked.
//
// A clock-in board on its own is an HR screen and belongs in an HR system. What
// makes it worth a page in a CMMS is the comparison: hours on site next to
// hours booked to work orders. The gap between the two is the number a
// maintenance manager can do something about, so it is the column the table
// sorts on.

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Card, Section, DataTable, StatusBadge, HBars, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { TECHNICIANS, WORK_ORDERS, SITES, seed, between, pick, EPOCH } from '../lib/data'

const { MUTE, SUB, INK, LINE, GREEN, AMBER, RED } = PALETTE

const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`

export default function Biometrics() {
  const [day, setDay] = useState(0)   // days back from today

  const rows = useMemo(() => TECHNICIANS.filter((t) => t.role !== 'Administrator').map((t, i) => {
    const k = `bio-${t.user_id}-${day}`
    const absent = seed(k + 'abs') > 0.88
    const inMin = 7 * 60 + between(k + 'in', -12, 38)
    const onSite = absent ? 0 : between(k + 'dur', 402, 552)
    const booked = absent ? 0 : Math.min(onSite, between(k + 'bk', 240, 500))
    return {
      user_id: t.user_id, name: t.name, role: t.role, trade: t.trade,
      site_name: pick(k + 'site', SITES).site_name,
      clock_in: absent ? null : hhmm(inMin),
      clock_out: absent ? null : hhmm(inMin + onSite),
      on_site: onSite,
      booked,
      // The number the page exists for.
      unbooked: onSite - booked,
      method: pick(k + 'm', ['Fingerprint', 'Face', 'Card']),
      status: absent ? 'Absent' : onSite < 420 ? 'Short day' : 'Present',
    }
  }), [day])

  const present = rows.filter((r) => r.status !== 'Absent')
  const totalOnSite = present.reduce((n, r) => n + r.on_site, 0)
  const totalBooked = present.reduce((n, r) => n + r.booked, 0)
  const utilisation = totalOnSite ? Math.round((totalBooked / totalOnSite) * 100) : 0

  const label = new Date(EPOCH - day * 86400000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })

  const columns = [
    {
      key: 'name', label: 'Member',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span style={avatar}>{r.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
          <span style={{ fontWeight: 600 }}>{r.name}</span>
        </span>
      ),
    },
    { key: 'trade', label: 'Trade' },
    { key: 'site_name', label: 'Site' },
    { key: 'clock_in', label: 'In', render: (r) => r.clock_in || <span style={{ color: MUTE }}>—</span> },
    { key: 'clock_out', label: 'Out', render: (r) => r.clock_out || <span style={{ color: MUTE }}>—</span> },
    { key: 'on_site', label: 'On site', align: 'right', render: (r) => (r.on_site ? hhmm(r.on_site) : '—') },
    { key: 'booked', label: 'Booked to work', align: 'right', render: (r) => (r.booked ? hhmm(r.booked) : '—') },
    {
      key: 'unbooked', label: 'Unbooked', align: 'right',
      render: (r) => {
        if (r.status === 'Absent') return <span style={{ color: MUTE }}>—</span>
        const bad = r.unbooked > 120
        return <span style={{ fontWeight: 700, color: bad ? RED : r.unbooked > 60 ? AMBER : GREEN }}>{hhmm(r.unbooked)}</span>
      },
    },
    { key: 'method', label: 'Method' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge tone={r.status === 'Present' ? 'green' : r.status === 'Absent' ? 'red' : 'amber'}>{r.status}</StatusBadge> },
  ]

  return (
    <div>
      <PageHeader
        icon={sectionIcon('biometrics', '#15227a')}
        title="Biometrics Dashboard"
        subtitle="Attendance measured against work booked"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NavBtn onClick={() => setDay((d) => d + 1)}>‹</NavBtn>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: INK, minWidth: 150, textAlign: 'center' }}>{label}</span>
            <NavBtn onClick={() => setDay((d) => Math.max(0, d - 1))} disabled={day === 0}>›</NavBtn>
          </div>
        }
      />

      <StatStrip items={[
        { label: 'On shift', value: present.length, note: `of ${rows.length} on the roster` },
        { label: 'Absent', value: rows.filter((r) => r.status === 'Absent').length, tone: rows.some((r) => r.status === 'Absent') ? 'amber' : 'green' },
        { label: 'Hours on site', value: hhmm(totalOnSite) },
        { label: 'Hours booked', value: hhmm(totalBooked) },
        { label: 'Wrench time', value: utilisation, unit: '%', tone: utilisation >= 70 ? 'green' : utilisation >= 55 ? 'amber' : 'red' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px, 100%),1fr))', gap: 14, marginBottom: 14 }}>
        <Section title="Hours booked by trade" style={{ margin: 0 }}>
          <HBars data={[...new Set(rows.map((r) => r.trade))].map((t) => ({
            name: t, value: Math.round(rows.filter((r) => r.trade === t).reduce((n, r) => n + r.booked, 0) / 60),
          }))} unit=" h" />
        </Section>
        <Section title="Wrench time" style={{ margin: 0 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: SUB, lineHeight: 1.55 }}>
            The share of paid time booked against a work order. Anything above 65% is good for a
            maintenance team; the rest goes on travel, waiting for permits and looking for parts.
          </p>
          <HBars data={present.map((r) => ({
            name: r.name,
            value: r.on_site ? Math.round((r.booked / r.on_site) * 100) : 0,
            color: r.on_site && r.booked / r.on_site >= 0.7 ? GREEN : AMBER,
          }))} unit="%" />
        </Section>
      </div>

      <DataTable columns={columns} rows={rows} pageSize={12} empty="Nobody on the roster." />
    </div>
  )
}

function NavBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff',
      color: disabled ? '#cbd5e1' : '#15227a', fontSize: 17, lineHeight: 1,
      cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
    }}>{children}</button>
  )
}

const avatar = {
  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
  background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff',
  fontSize: 9.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
