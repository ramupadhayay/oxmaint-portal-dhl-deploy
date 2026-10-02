'use client'

import { useMemo, useState } from 'react'
import { PageHeader, StatStrip, Card, Section, StatusBadge, Bar, ActionButton, Fields, PALETTE } from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { CreateModal } from '../lib/forms'
import { useSite } from '../lib/siteStore'
import { SHUTDOWNS, money, fmtDate, daysUntil, isPast } from '../lib/data'

const { MUTE, SUB, INK, LINE, GREEN, AMBER, BLUE } = PALETTE

const idOf = (r) => r.shutdown_id || r.recordId

export default function Shutdown() {
  const { create } = useStore()
  const [creating, setCreating] = useState(false)
  const seededPlusStored = useRecords('shutdown', SHUTDOWNS, idOf)
  const { scope, siteName } = useSite()
  const all = useMemo(() => scope(seededPlusStored), [scope, seededPlusStored])

  return (
    <div>
      <PageHeader
        icon={sectionIcon('shutdown', '#15227a')}
        title="Shutdown Plans"
        subtitle={`Planned outages and turnarounds · ${siteName}`}
        right={<ActionButton onClick={() => setCreating(true)}>New shutdown</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Shutdowns', value: all.length },
        { label: 'Planned', value: all.filter((s) => s.status === 'Planned').length, tone: 'blue' },
        { label: 'In progress', value: all.filter((s) => s.status === 'In Progress').length, tone: 'amber' },
        { label: 'Tasks outstanding', value: all.reduce((n, s) => n + (s.tasks - s.tasks_done), 0) },
        { label: 'Committed budget', value: money(all.reduce((n, s) => n + s.budget, 0)) },
      ]} />

      {all.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(360px, 100%),1fr))', gap: 14 }}>
          {all.map((s) => {
            const days = daysUntil(s.start_date)
            const when = s.status === 'Completed' ? 'Completed'
              : isPast(s.start_date) ? 'Running now'
                : `Starts in ${days} days`
            // idOf, not shutdown_id: a shutdown created in the portal carries
            // only a recordId, so keying on shutdown_id gave that card
            // key={undefined} and React warned on every render.
            return (
              <Card key={idOf(s)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK }}>{s.name}</h3>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTE }}>{s.site_name} · {when}</p>
                  </div>
                  <StatusBadge>{s.status}</StatusBadge>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: SUB, fontWeight: 600 }}>Progress</span>
                    <span style={{ fontWeight: 800, color: s.progress === 100 ? GREEN : s.progress > 0 ? AMBER : MUTE }}>{s.progress}%</span>
                  </div>
                  <Bar pct={s.progress} color={s.progress === 100 ? GREEN : s.progress > 0 ? AMBER : BLUE} />
                  <p style={{ margin: '6px 0 0', fontSize: 11.5, color: MUTE }}>{s.tasks_done} of {s.tasks} tasks complete</p>
                </div>

                <div style={{ paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
                  <Fields columns={2} rows={[
                    ['Window', `${fmtDate(s.start_date)} → ${fmtDate(s.end_date)}`],
                    ['Duration', `${Math.max(1, Math.round((new Date(s.end_date) - new Date(s.start_date)) / 86400000))} days`],
                    ['Manager', s.manager],
                    ['Budget', money(s.budget)],
                  ]} />
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card><div style={{ padding: '34px 0', textAlign: 'center', color: MUTE, fontSize: 12.5 }}>No shutdowns planned at {siteName}.</div></Card>
      )}

      <CreateModal kind="shutdown" open={creating} onClose={() => setCreating(false)}
        onSubmit={(values) => create('shutdown', values)} />
    </div>
  )
}
