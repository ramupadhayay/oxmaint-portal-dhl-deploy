'use client'

// Settings — the numbers everything else is derived from.
//
// Shown rather than edited. The rotation length, the shift length and the
// checklist are what the schedule, the board and the PM library are all
// computed out of, so this screen is the honest answer to "where did 1.1 suites
// a day come from" — which is a question worth being able to answer in front of
// a customer.
//
// They are read-only because changing the cycle would move every date the
// portal shows, and a demo where a stray click reshuffles the whole property is
// a demo that cannot be rehearsed.

import {
  PageHeading, Section, Card, Fields, StatusBadge, PALETTE,
} from '../lib/kit'
import { useStore } from '../lib/store'
import {
  ORG, USER, SITE, LOCATIONS, SUITE_COUNT, CYCLE_DAYS, SHIFT_MINUTES,
  SUITE_PM, ROUNDS, ASSETS, fmtDate,
} from '../lib/data'
import { ROTATION } from '../lib/schedule'
import { MENU } from '../lib/nav'
import { useVisibility } from '../lib/visibility'
import { COMMUNITY } from '../lib/community'

// The two estates this property runs, as presets. A demo does not want to work
// through fourteen switches in front of an audience — it wants the hotel, or it
// wants the board.
const HOTEL_GROUPS = ['ops-grp', 'property-grp', 'maint-grp', 'safety-grp', 'inventory-grp']
const COMMUNITY_GROUPS = ['community-grp']

const { ACCENT, INK, SUB, MUTE, LINE } = PALETTE

export default function Settings() {
  const { isHidden, canHide, toggle, showAll, showOnly, hidden } = useVisibility()
  const store = useStore()
  const persisted = store?.persisted

  return (
    <div>
      <PageHeading
        title="Settings"
        subtitle="The property, and the figures every screen is derived from"
      />

      <Section title="Property" right={<span style={{ fontSize: 11.5, color: MUTE }}>Where the name in the profile menu comes from</span>}>
        <Fields columns={2} rows={[
          ['Organisation', ORG.organization_name],
          ['Code', ORG.organization_code],
          ['Industry', ORG.industry],
          ['Address', `${ORG.address}, ${ORG.city}`],
          ['Country', ORG.country],
          ['Time zone', ORG.timezone],
          ['Currency', `${ORG.currency} (${ORG.currency_symbol})`],
          ['Site', SITE.site_name],
        ]} />
      </Section>

      <Section title="Signed in as">
        <Fields columns={2} rows={[
          ['Name', USER.name],
          ['Role', USER.role_name],
          ['Email', USER.email],
          ['Last login', fmtDate(USER.last_login)],
        ]} />
      </Section>

      <Section
        title="The rotation"
        right={<span style={{ fontSize: 11.5, color: MUTE }}>Everything on the schedule comes out of these four numbers</span>}
      >
        <Fields columns={2} rows={[
          ['Suites', SUITE_COUNT],
          ['Cycle length', `${CYCLE_DAYS} days`],
          ['PM per suite', `${SUITE_PM.minutes} min · ${SUITE_PM.checklist.length} checkpoints`],
          ['Shift', `${SHIFT_MINUTES / 60} hours`],
        ]} />
        <div style={{
          marginTop: 14, padding: '11px 13px', borderRadius: 9,
          background: '#f8fafc', border: `1px solid ${LINE}`,
          fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: SUB, lineHeight: 1.7,
        }}>
          {SUITE_COUNT} suites ÷ {CYCLE_DAYS} days = <strong style={{ color: INK }}>{ROTATION.perDay} suites/day</strong><br />
          {ROTATION.perDay} × {SUITE_PM.minutes} min = <strong style={{ color: INK }}>{Math.round(ROTATION.perDay * SUITE_PM.minutes)} min/day</strong> on the rotation<br />
          of a {SHIFT_MINUTES / 60}-hour shift — the rest is rounds and the backlog
        </div>
      </Section>

      <Section title="Rounds" right={<span style={{ fontSize: 11.5, color: MUTE }}>{ROUNDS.length} repeating checks</span>}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ROUNDS.map((r) => (
            <div key={r.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px',
              borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap',
            }}>
              <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: 12.5, color: INK }}>{r.label}</span>
              <StatusBadge tone={r.every === 'day' ? 'blue' : r.every === 'week' ? 'violet' : 'grey'}>
                {r.every === 'day' ? 'Daily' : r.every === 'week' ? 'Weekly' : 'Monthly'}
              </StatusBadge>
              <span style={{ fontSize: 11.5, color: SUB, minWidth: 42, textAlign: 'right' }}>{r.minutes}m</span>
              {r.compliance && <StatusBadge tone="blue">{r.compliance}</StatusBadge>}
            </div>
          ))}
        </div>
      </Section>

      {/* ── which modules this property runs ──────────────────────────
          This portal carries two estates and neither wants the other's
          screens. A hotel's engineers have no use for reserve fund
          forecasting; a condo board has no use for suite rotation. Switching
          a group off here takes it out of the sidebar and the command palette,
          and the choice is stored rather than held in state — so it survives a
          reload and is the same for the next person. */}
      <Section
        title="Modules"
        right={(
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button onClick={() => showOnly(HOTEL_GROUPS)} style={styles.preset}>Hotel only</button>
            <button onClick={() => showOnly(COMMUNITY_GROUPS)} style={styles.preset}>Community only</button>
            <button onClick={showAll} style={{ ...styles.preset, ...(hidden.length ? null : styles.presetOn) }}>
              Show all
            </button>
          </div>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
          {MENU.map((g) => {
            const off = isHidden(g.key)
            const locked = !canHide(g.key)
            const count = g.single ? 1 : g.children.length
            return (
              <div
                key={g.key}
                role={locked ? undefined : 'button'}
                tabIndex={locked ? undefined : 0}
                onClick={() => !locked && toggle(g.key)}
                onKeyDown={(e) => { if (!locked && e.key === 'Enter') toggle(g.key) }}
                style={{
                  ...styles.moduleCard,
                  opacity: off ? 0.6 : 1,
                  cursor: locked ? 'default' : 'pointer',
                  borderColor: off ? LINE : '#c7d2fe',
                  background: off ? '#f8fafc' : '#fbfcff',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ fontSize: 12.5, color: off ? MUTE : INK, display: 'block' }}>{g.label}</strong>
                  <span style={{ fontSize: 10.5, color: MUTE }}>
                    {locked ? 'always on' : `${count} ${count === 1 ? 'screen' : 'screens'}`}
                    {g.key === 'community-grp' ? ` · ${COMMUNITY.short}` : ''}
                  </span>
                </div>
                <span style={{ ...styles.switch, ...(off || locked ? null : styles.switchOn), opacity: locked ? 0.4 : 1 }}>
                  <span style={{ ...styles.knob, ...(off || locked ? null : styles.knobOn) }} />
                </span>
              </div>
            )
          })}
        </div>
        <p style={styles.moduleNote}>
          Overview and Organization stay on — switching off the screen that holds
          these switches is a door that locks behind you.{' '}
          {hidden.length
            ? <><strong style={{ color: INK }}>{hidden.length} {hidden.length === 1 ? 'group is' : 'groups are'} hidden</strong> right now.</>
            : 'Every group is showing.'}
        </p>
      </Section>

      <Section title="This deployment">
        <Fields columns={2} rows={[
          ['Storage', persisted === false
            ? <StatusBadge key="p" tone="amber">Read-only — no database</StatusBadge>
            : <StatusBadge key="p" tone="green">Connected</StatusBadge>],
          ['Areas', LOCATIONS.length],
          ['Assets tracked', ASSETS.length],
          ['Records', 'Prefixed hosp_, kept apart from the other portals'],
        ]} />
      </Section>

      <Card>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          Read-only in this build. The cycle length and shift are what every date on the
          schedule and the rotation board are computed from, so changing one here would
          move every screen at once — worth doing deliberately in a configuration step,
          not from a demo.
        </p>
      </Card>
    </div>
  )
}

// The module switches. Inline everywhere else in this file, but a toggle is
// five interdependent rules and repeating them at each call site is how one of
// them drifts.
const styles = {
  preset: {
    padding: '5px 11px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 999, background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  presetOn: { color: ACCENT, background: '#eef2ff', borderColor: '#c7d2fe' },
  moduleCard: {
    display: 'flex', alignItems: 'center', gap: 11, userSelect: 'none',
    padding: '11px 13px', borderRadius: 10,
    borderStyle: 'solid', borderWidth: 1,
  },
  switch: {
    width: 36, height: 21, flexShrink: 0, borderRadius: 999, padding: 2,
    background: '#e2e8f0', display: 'flex', alignItems: 'center',
    transition: 'background .16s',
  },
  switchOn: { background: ACCENT },
  knob: {
    width: 17, height: 17, borderRadius: '50%', background: '#fff',
    transition: 'transform .16s', boxShadow: '0 1px 3px rgba(15,23,42,0.22)',
  },
  knobOn: { transform: 'translateX(15px)' },
  moduleNote: {
    margin: '14px 0 0', paddingTop: 12, fontSize: 11.5, color: MUTE, lineHeight: 1.6,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
}
