'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Card, StatusBadge, ActionButton, HBars, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { TEAMS, TECHNICIANS, WORK_ORDERS, SITES, OPEN_STATUS, isPast } from '../lib/data'

const { MUTE, SUB, INK, LINE } = PALETTE

const idOf = (r) => r.team_id || r.recordId

export default function Teams() {
  const { create } = useStore()
  const [creating, setCreating] = useState(false)
  const seededPlusStored = useRecords('team', TEAMS, idOf)
  const { scope, siteName } = useSite()

  const teams = useMemo(() => scope(seededPlusStored).map((t) => {
    const members = TECHNICIANS.filter((p) => p.trade === t.team_name)
    const work = WORK_ORDERS.filter((w) => members.some((m) => m.name === w.assigned_to_name))
    const live = work.filter((w) => OPEN_STATUS.includes(w.status))
    return {
      ...t,
      roster: members,
      open: live.length,
      overdue: live.filter((w) => isPast(w.due_date)).length,
      completed: work.filter((w) => w.status === 'Completed').length,
    }
  }), [scope, seededPlusStored])

  return (
    <div>
      <PageHeader
        icon={sectionIcon('teams', '#15227a')}
        title="Teams"
        subtitle={`Maintenance crews and their load · ${siteName}`}
        right={<ActionButton onClick={() => setCreating(true)}>New team</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Teams', value: teams.length },
        { label: 'People', value: teams.reduce((n, t) => n + t.roster.length, 0) },
        { label: 'Open work', value: teams.reduce((n, t) => n + t.open, 0) },
        { label: 'Overdue', value: teams.reduce((n, t) => n + t.overdue, 0), tone: 'red' },
      ]} />

      {teams.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px, 100%),1fr))', gap: 14 }}>
          {teams.map((t) => (
            <Card key={t.team_id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 13 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK }}>{t.team_name}</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTE }}>
                    Lead: {t.lead_name} · {SITES.find((s) => s.site_id === t.site_id)?.site_name}
                  </p>
                </div>
                {t.overdue > 0 && <StatusBadge tone="red">{t.overdue} overdue</StatusBadge>}
              </div>

              <HBars data={[
                { name: 'Open work orders', value: t.open, color: '#f59e0b' },
                { name: 'Completed', value: t.completed, color: '#10b981' },
              ]} />

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                  Roster ({t.roster.length})
                </div>
                {t.roster.length ? t.roster.map((m) => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5 }}>
                    <span style={avatar}>{m.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                    <span style={{ color: INK, fontWeight: 500 }}>{m.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: SUB }}>{m.role}</span>
                  </div>
                )) : <p style={{ margin: 0, fontSize: 12, color: MUTE }}>No members assigned to this trade.</p>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><div style={{ padding: '34px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>No teams at {siteName}.</div></Card>
      )}

      <CreateModal kind="team" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('team', values)} />
    </div>
  )
}

const avatar = {
  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
  background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff',
  fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
