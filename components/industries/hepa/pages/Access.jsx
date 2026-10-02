'use client'

// Roles and access.
//
// The brief asks for "role-based access control so Quality, Manufacturing, and
// site leadership see the views relevant to their role without exposing edit
// rights to locked records." This screen is where that is shown as a matrix
// rather than described, and where the demo switches between the three to
// watch the buttons change.
//
// The three roles are the customer's own. Their Document Lifecycle sheet routes
// records to Quality Reviewer, Manufacturing Supervisor and Site Quality Lead,
// and those are the three — not a generic admin/editor/viewer ladder that would
// have to be mapped onto their organisation later.
//
// The row that matters most is the last one, and it has no ticks in it at all.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Card, Section, PALETTE,
} from '../lib/kit'
import { SECTION_LABEL } from '../lib/nav'
import { useDocuments } from '../lib/lifecycle'
import { ROLES, CAPABILITIES, useRole, isLocked, LOCKED_REASON } from '../lib/roles'

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

// The capabilities in the order a person would ask about them, with the plain
// name rather than the key.
const SHOWN = [
  ['raiseWork', 'Raise a work order or request'],
  ['runChecklist', 'Record a checklist run'],
  ['triage', 'Triage a request into an order'],
  ['route', 'Route a certification for review'],
  ['sign', 'Apply an electronic signature'],
  ['reject', 'Return a record with a reason'],
  ['sapPost', 'Confirm a test in SAP'],
  ['export', 'Generate an audit package'],
  ['hold', 'Place or lift a legal hold'],
  ['configureRouting', 'Change the routing rules'],
  ['viewSap', 'See the SAP integration'],
]

export default function Access() {
  const router = useRouter()
  const { role, setRole } = useRole()
  const documents = useDocuments()

  const locked = useMemo(() => documents.filter(isLocked).length, [documents])

  return (
    <div>
      <PageHeading
        title="Roles & Access"
        subtitle="Who can do what. The three roles are the ones the workbook already routes records to — Quality Reviewer, Manufacturing Supervisor and Site Quality Lead — rather than a generic permission ladder to be mapped on later."
      />

      <StatCards items={[
        { label: 'Roles', value: ROLES.length, icon: 'people', note: 'from the workbook\'s own routing' },
        { label: 'Gated actions', value: SHOWN.length, icon: 'list', note: 'each refused with a reason' },
        { label: 'Locked records', value: locked, icon: 'tick', tone: 'green', note: 'no role can edit these' },
        { label: 'Viewing as', value: role.short, icon: 'asset', note: role.person },
      ]} />

      {/* ── switch ─────────────────────────────────────────────────────── */}
      <Section title="View the portal as">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
          {ROLES.map((r) => {
            const on = r.id === role.id
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setRole(r.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRole(r.id) }}
                style={{ ...styles.card, ...(on ? { borderColor: r.accent, background: '#fbfcff' } : null) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ ...styles.avatar, background: r.accent }}>{r.initials}</span>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 13, color: INK, display: 'block' }}>{r.name}</strong>
                    <span style={{ fontSize: 11, color: MUTE }}>{r.person}</span>
                  </span>
                  <span style={{ ...styles.radio, ...(on ? { borderColor: r.accent, borderWidth: 5 } : null) }} />
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>{r.what}</p>
                <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${LINE}`, fontSize: 10.5, color: MUTE }}>
                  {r.can.length} of {SHOWN.length} actions
                  {r.hidden.length ? ` · ${r.hidden.length} screens hidden` : ' · all screens'}
                </div>
              </div>
            )
          })}
        </div>
        <p style={styles.note}>
          Switching here changes the whole portal, not this screen. Go to{' '}
          <button onClick={() => router.push('/portal/hepa/approvals')} style={styles.inline}>Approvals</button>{' '}
          as Manufacturing and the signature panel is refused with the reason on
          it; come back as Quality and it signs. The same switch is in the
          profile menu on every screen.
        </p>
      </Section>

      {/* ── the matrix ─────────────────────────────────────────────────── */}
      <Section title="What each role can do">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...styles.th, textAlign: 'left', minWidth: 230 }}>Action</th>
                {ROLES.map((r) => (
                  <th key={r.id} style={{ ...styles.th, textAlign: 'center' }}>
                    <span style={{ color: r.id === role.id ? r.accent : undefined }}>{r.short}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SHOWN.map(([cap, label]) => (
                <tr key={cap} style={{ borderBottom: `1px solid ${LINE}` }}>
                  <td style={{ padding: '9px 14px', color: INK }}>
                    {label}
                    <span style={{ display: 'block', fontSize: 10.5, color: MUTE, lineHeight: 1.45, marginTop: 2 }}>
                      {CAPABILITIES[cap]}
                    </span>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r.id} style={{ padding: '9px 14px', textAlign: 'center' }}>
                      {r.can.includes(cap) ? <Tick colour={r.accent} /> : <Dash />}
                    </td>
                  ))}
                </tr>
              ))}

              {/* The row with no ticks. */}
              <tr style={{ background: '#fef7f7' }}>
                <td style={{ padding: '11px 14px', color: INK }}>
                  <strong>Edit a locked, audit-ready record</strong>
                  <span style={{ display: 'block', fontSize: 10.5, color: SUB, lineHeight: 1.45, marginTop: 2 }}>
                    {LOCKED_REASON}
                  </span>
                </td>
                {ROLES.map((r) => (
                  <td key={r.id} style={{ padding: '11px 14px', textAlign: 'center' }}>
                    <Dash />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p style={styles.note}>
          The last row has no ticks and no role attached to it. A locked record
          is what the audit package claims is final — a permission that could
          unlock it would make the claim untrue, so there is not one.
        </p>
      </Section>

      {/* ── what each role sees ────────────────────────────────────────── */}
      <Section title="Screens by role">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          {ROLES.map((r) => (
            <div key={r.id} style={styles.plain}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.accent, flexShrink: 0 }} />
                <strong style={{ fontSize: 12.5, color: INK }}>{r.name}</strong>
              </div>
              {r.hidden.length ? (
                <>
                  <div style={{ fontSize: 11.5, color: SUB, marginBottom: 6 }}>Cannot open:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.hidden.map((s) => (
                      <span key={s} style={styles.hiddenChip}>{SECTION_LABEL[s] || s}</span>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>
                  Every screen. What differs is which buttons work.
                </div>
              )}
            </div>
          ))}
        </div>
        <p style={styles.note}>
          Little is hidden, on purpose. The brief&apos;s emphasis is on edit rights,
          and a register somebody cannot open is a register they will ask a
          colleague to read out to them. A technician sees the approvals queue
          and the audit trail; what they cannot do is sign. An action that is
          visible and refused with a stated reason teaches the workflow — one
          that is invisible teaches nothing.
        </p>
      </Section>

      <Card style={{ background: '#fcfdfe' }}>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
          <strong style={{ color: INK }}>Still to confirm with the customer.</strong> The brief asks
          whether HEPA test records need a single reviewer or a multi-step QA and
          Manufacturing sign-off, and whether an existing 21 CFR Part 11-validated
          e-signature system should be reused rather than duplicated. Both change
          this matrix, and neither is ours to answer.
        </p>
      </Card>
    </div>
  )
}

function Tick({ colour }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-label="yes">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function Dash() {
  return <span style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 700 }} aria-label="no">—</span>
}

const styles = {
  card: {
    padding: '13px 15px', borderRadius: 11, background: '#fff', cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, userSelect: 'none',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', color: '#fff', flexShrink: 0,
    display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700,
  },
  radio: {
    marginLeft: 'auto', width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
    background: '#fff', borderStyle: 'solid', borderWidth: 2, borderColor: LINE,
  },
  th: {
    padding: '10px 14px', fontSize: 11, fontWeight: 700, color: SUB,
    textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${LINE}`,
  },
  plain: {
    padding: '12px 14px', borderRadius: 10, background: '#fcfdfe',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  hiddenChip: {
    fontSize: 10.5, fontWeight: 600, color: '#b45309', background: '#fffbeb',
    borderRadius: 6, padding: '2px 8px',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a',
  },
  note: {
    margin: '14px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.6,
  },
  inline: {
    padding: 0, border: 'none', background: 'none', color: ACCENT,
    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
  },
}
