'use client'

// Explore Apps — what this can be connected to, as against what it is.
//
// Integrations answers "what is wired up here"; this answers "what could be".
// They are different questions and the product gives each its own entry, which
// is why the connector map stopped being the whole story: a buyer asking
// whether their Maximo can feed this is not helped by a pipeline diagram of
// somebody else's SAP.
//
// The catalogue is the product's own list, name for name — the CMMS and EAM
// platforms it names as importable, the business systems it exchanges with, and
// the logger it reads directly. Nothing invented: an integration this portal
// claims and the product does not is a promise somebody has to keep in a
// meeting.
//
// What is honest about it is the status. Nothing here is connected in a demo,
// and a marketplace of green ticks would say the opposite — so every card reads
// as available, the ones already wired up on the Integrations screen say so,
// and the rest carry the route in rather than a Connect button that does
// nothing.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, Section, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { INTEGRATIONS } from '../lib/data'

const { ACCENT, INK, SUB, MUTE, LINE, GREEN } = PALETTE

/**
 * The product's own catalogue.
 *
 * Grouped the way it groups them: the maintenance systems a customer is
 * migrating from or running alongside, the business systems the record has to
 * reach, and the instruments it reads. `how` is the direction of travel, which
 * is the thing a buyer actually asks and a logo wall never answers.
 */
const CATALOGUE = [
  {
    group: 'CMMS & EAM platforms',
    what: 'Import an existing maintenance record — assets, history, schedules — or run alongside one during a migration.',
    apps: [
      { name: 'IBM Maximo', how: 'Import assets, work orders and PM schedules' },
      { name: 'SAP', how: 'Two-way work order and notification exchange' },
      { name: 'Oracle EAM', how: 'Import assets and maintenance history' },
      { name: 'Infor EAM (Hexagon)', how: 'Import assets and work orders' },
      { name: 'MP2 by Infor', how: 'One-off migration of assets and history' },
      { name: 'eMaint CMMS (Fluke)', how: 'Import assets, parts and schedules' },
      { name: 'Maintenance Connection', how: 'Import assets and work history' },
      { name: 'MicroMain CMMS', how: 'One-off migration of assets and PM' },
      { name: 'CHAMPS CMMS', how: 'Import assets and maintenance history' },
      { name: 'DIMO Maint', how: 'Import assets and work orders' },
      { name: 'Mainsaver', how: 'One-off migration of assets and history' },
      { name: 'Carl Source', how: 'Import assets and maintenance history' },
    ],
  },
  {
    group: 'Business systems',
    what: 'Where the maintenance record has to reach the rest of the business — cost, tickets, reporting.',
    apps: [
      { name: 'Microsoft Dynamics', how: 'Cost centres, purchase and vendor master' },
      { name: 'QuickBooks', how: 'Purchase orders and invoices out' },
      { name: 'ServiceNow', how: 'Raise and close tickets against work orders' },
      { name: 'Power BI', how: 'Read the maintenance record for reporting' },
      { name: 'Custom APIs', how: 'Anything else, over the documented REST API' },
    ],
  },
  {
    group: 'Instruments',
    what: 'Read directly, without a system in between.',
    apps: [
      { name: 'Therma Data Logger', how: 'Temperature readings straight onto the asset' },
    ],
  },
]

const ALL = CATALOGUE.flatMap((g) => g.apps)

export default function ExploreApps() {
  const router = useRouter()
  const [q, setQ] = useState('')

  // What the Integrations screen already shows as wired up. Matched on name so
  // a card cannot say "available" about something the other screen says is
  // streaming — two screens disagreeing about the same connector is the first
  // thing an audience notices.
  const connected = useMemo(() => {
    const live = new Set(
      (INTEGRATIONS || [])
        .filter((i) => /connected|active|live|streaming/i.test(i.status || ''))
        .map((i) => String(i.name || '').toLowerCase())
    )
    return (name) => live.has(name.toLowerCase())
  }, [])

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return CATALOGUE
    return CATALOGUE
      .map((g) => ({ ...g, apps: g.apps.filter((a) => `${a.name} ${a.how}`.toLowerCase().includes(needle)) }))
      .filter((g) => g.apps.length)
  }, [q])

  const liveCount = ALL.filter((a) => connected(a.name)).length

  return (
    <div>
      <PageHeader
        icon={sectionIcon('integrations', '#15227a')}
        title="Explore Apps"
        subtitle={`${ALL.length} platforms this record can be connected to · ${liveCount} already wired up`}
        right={(
          <button onClick={() => router.push('/portal/oxmaint/integrations')} style={styles.link}>
            My Integrations →
          </button>
        )}
      />

      <div style={{ marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a platform — Maximo, SAP, Power BI…"
          style={styles.search}
        />
      </div>

      {groups.length === 0 ? (
        <Section title="Nothing matches">
          <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>
            No platform in the catalogue matches “{q.trim()}”. Anything not listed connects over
            the documented REST API.
          </p>
        </Section>
      ) : groups.map((g) => (
        <Section
          key={g.group}
          title={g.group}
          right={<span style={{ fontSize: 11.5, color: MUTE }}>{g.apps.length}</span>}
        >
          <p style={styles.what}>{g.what}</p>
          <div style={styles.grid}>
            {g.apps.map((a) => {
              const live = connected(a.name)
              return (
                <div key={a.name} style={{ ...styles.card, borderColor: live ? '#a7f3d0' : LINE }}>
                  <div style={styles.cardTop}>
                    <span style={styles.mark}>{initials(a.name)}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={styles.name}>{a.name}</span>
                      <span style={styles.how}>{a.how}</span>
                    </span>
                  </div>
                  {live ? (
                    <button onClick={() => router.push('/portal/oxmaint/integrations')} style={styles.liveBtn}>
                      <span style={styles.dot} />Connected — open
                    </button>
                  ) : (
                    <span style={styles.avail}>Available</span>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      ))}

      <Section title="Not on the list">
        <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.6, maxWidth: 720 }}>
          Everything here is reachable over the same documented REST API, so a system that is not
          named is a mapping exercise rather than a missing feature. The catalogue is what has been
          done before and is therefore quick.
        </p>
      </Section>
    </div>
  )
}

const initials = (name) => name
  .replace(/\(.*\)/, '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((w) => w[0])
  .join('')
  .toUpperCase()

const styles = {
  search: {
    width: '100%', maxWidth: 420, boxSizing: 'border-box', padding: '9px 12px',
    fontSize: 13, fontFamily: 'inherit', color: INK, background: '#fff',
    border: `1px solid ${LINE}`, borderRadius: 10, outline: 'none',
  },
  what: { margin: '0 0 13px', fontSize: 12.5, color: SUB, lineHeight: 1.6, maxWidth: 720 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(268px,1fr))', gap: 11 },
  card: {
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12,
    padding: '13px 15px', borderRadius: 12, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, minHeight: 108,
  },
  cardTop: { display: 'flex', gap: 11, alignItems: 'flex-start' },
  mark: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
    background: '#eef2ff', color: ACCENT, fontSize: 12, fontWeight: 800,
  },
  name: { display: 'block', fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.35 },
  how: { display: 'block', fontSize: 11.5, color: MUTE, marginTop: 4, lineHeight: 1.5 },
  avail: { fontSize: 11, fontWeight: 700, color: MUTE, letterSpacing: '.02em' },
  liveBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    padding: '5px 11px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
    color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0',
    borderRadius: 999, cursor: 'pointer',
  },
  dot: { width: 6, height: 6, borderRadius: '50%', background: GREEN },
  link: {
    background: 'none', border: 'none', color: ACCENT, fontSize: 12,
    fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
}
