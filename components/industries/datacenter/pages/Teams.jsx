'use client'

// Teams — the crews that carry the work on this estate, and their live load.
//
// Ported from the CMMS portal's Teams module onto this portal's own data. A
// team's load is not stored: it is counted from the work orders assigned to that
// crew, so it can never drift from the work-order list. Site Engineering is a
// crew per hall; the OEM and vendor partners work across the estate. A team
// added here persists under the portal's own record kind.

import { useMemo, useState } from 'react'
import { Section, Card, StatusBadge, ActionButton, HBars, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import Modal from '../components/Modal'
import { useSite } from '../lib/siteStore'
import { useTeamStore } from '../lib/store'
import { WORK_ORDER_ROWS, SITES } from '../lib/data'
import { DC_TEAMS, DC_PEOPLE } from '../lib/orgData'

const { MUTE, SUB, INK, LINE } = PALETTE

const siteLabel = (id) => SITES.find((s) => s.siteId === id)?.siteName || id
const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export default function Teams() {
  const { siteId, siteName } = useSite()
  const store = useTeamStore()
  const [creating, setCreating] = useState(false)

  // Seeded crews plus anything added here. Created teams carry no roster yet, so
  // they read as a crew with its lead and no members until people are assigned.
  const all = useMemo(() => {
    const seededIds = new Set(DC_TEAMS.map((t) => t.team_id))
    const created = store.created.filter((r) => !seededIds.has(r.team_id))
    return [...DC_TEAMS, ...created]
  }, [store.created])

  const teams = useMemo(() => all
    .filter((t) => siteId === 'all' || !t.site_id || t.site_id === siteId)
    .map((t) => {
      const roster = DC_PEOPLE.filter((p) => p.team_id === t.team_id)
      const work = WORK_ORDER_ROWS.filter((w) => (
        (w.assignedTo || '').includes(t.crew) && (!t.site_id || w.siteId === t.site_id)
      ))
      const open = work.filter((w) => !/completed/i.test(w.status || '')).length
      const completed = work.filter((w) => /completed/i.test(w.status || '')).length
      return { ...t, roster, open, completed }
    }), [all, siteId])

  const stats = [
    { label: 'Teams', value: teams.length, icon: 'people' },
    { label: 'People', value: teams.reduce((n, t) => n + t.roster.length, 0), icon: 'people' },
    { label: 'Open work orders', value: teams.reduce((n, t) => n + t.open, 0), tone: 'amber', icon: 'wrench' },
    { label: 'Completed', value: teams.reduce((n, t) => n + t.completed, 0), tone: 'green', icon: 'tick' },
  ]

  const submit = async (v) => {
    await store.create({
      team_id: `DCT-${Date.now().toString(36).slice(-4)}`,
      team_name: v.team_name, crew: v.crew || v.team_name, discipline: v.discipline || '—',
      lead_name: v.lead_name || '—', site_id: v.site_id || null,
    })
  }

  return (
    <div>
      <PageHeading
        title="Teams"
        subtitle={`Maintenance crews and their live load · ${siteName}`}
        right={<ActionButton onClick={() => setCreating(true)}>New team</ActionButton>}
      />

      <StatCards items={stats} />

      {teams.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
          {teams.map((t) => (
            <Card key={t.team_id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK }}>{t.team_name}</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTE }}>
                    Lead: {t.lead_name} · {t.site_id ? siteLabel(t.site_id) : 'Estate-wide'}
                  </p>
                </div>
                <StatusBadge tone="grey">{t.discipline}</StatusBadge>
              </div>

              <HBars data={[
                { name: 'Open work orders', value: t.open },
                { name: 'Completed', value: t.completed },
              ]} />

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                  Roster ({t.roster.length})
                </div>
                {t.roster.length ? t.roster.map((m) => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
                    <span style={avatar}>{initials(m.name)}</span>
                    <span style={{ color: INK, fontWeight: 500 }}>{m.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: SUB }}>{m.role}</span>
                  </div>
                )) : <p style={{ margin: 0, fontSize: 12, color: MUTE }}>No roster assigned yet.</p>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><div style={{ padding: '34px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>No teams at {siteName}.</div></Card>
      )}

      <Modal
        open={creating}
        title="New team"
        submitLabel="Add team"
        onClose={() => setCreating(false)}
        onSubmit={submit}
        fields={[
          { key: 'team_name', label: 'Team name', required: true, placeholder: 'e.g. Site Engineering — Frankfurt' },
          { key: 'crew', label: 'Crew keyword (matches work-order assignee)', placeholder: 'e.g. Site Engineering' },
          { key: 'discipline', label: 'Discipline', placeholder: 'e.g. Mechanical & Electrical' },
          { key: 'lead_name', label: 'Lead', placeholder: 'Team lead name' },
          { key: 'site_id', label: 'Site (blank = estate-wide)', options: SITES.map((s) => ({ value: s.siteId, label: s.siteName })) },
        ]}
      />
    </div>
  )
}

const avatar = {
  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
  background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff',
  fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
