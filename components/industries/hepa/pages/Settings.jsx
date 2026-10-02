'use client'

// Where the portal explains itself.
//
// Three thresholds decide almost every judgement on this portal, and all three
// come from the customer's own workbook rather than from us. Showing them here,
// with the sheet and the cell label they came from, is what lets a reviewer
// check a number they disagree with instead of arguing with the screen.
//
// The open question about the penetration column is on this page in full. It is
// the one ambiguity in the file that we could not resolve from the data, and
// burying it in a code comment would be the wrong place for something the
// client is the only one who can answer.

import { useRouter } from 'next/navigation'
import {
  PageHeading, Card, Section, Fields, PALETTE,
} from '../lib/kit'
import {
  ORG, USER, THRESHOLDS, ANCHOR_SUMMARY, ANCHOR_NOTE, WORKBOOK_DASHBOARD,
  FILTER_VIEW, TEST_RECORDS, LEAK_RECORDS, REPLACEMENT_RECORDS, SAP_RECORDS,
  DOCUMENT_RECORDS, CLEANROOMS, fmtDate, pct,
} from '../lib/data'
import { Derived, FromWorkbook } from '../lib/ui'
import { ROLES, useRole } from '../lib/roles'

// The handful of actions worth showing as chips beside the role cards. The
// full list, with the reason each is refused, is on the Roles & Access screen —
// this is the summary a person wants without leaving Settings.
const GATED = [
  ['sign', 'Sign records'],
  ['route', 'Route for review'],
  ['hold', 'Legal hold'],
  ['export', 'Audit package'],
  ['sapPost', 'Confirm in SAP'],
  ['configureRouting', 'Edit routing rules'],
  ['raiseWork', 'Raise work'],
]

const { INK, SUB, MUTE, LINE, ACCENT } = PALETTE

const SHEETS = [
  ['Filter Asset Registry', FILTER_VIEW.length, 'filters, with cleanroom, ISO class, install date, QR code and test interval'],
  ['DOP-PAO Test Log', TEST_RECORDS.length, 'integrity tests, with scan points, penetration, result, technician and lock status'],
  ['Leak Detection Log', LEAK_RECORDS.length, 'pressure differential readings, scheduled and alert-triggered'],
  ['Filter Replacement', REPLACEMENT_RECORDS.length, 'replacement events, with serials, supplier certificate and validation tests'],
  ['SAP Integration Map', SAP_RECORDS.length, 'mappings to SAP equipment ids, functional locations and work orders'],
  ['Document Lifecycle', DOCUMENT_RECORDS.length, 'certification documents, with stage, reviewer, signature, retention and next due'],
  ['Compliance Dashboard', WORKBOOK_DASHBOARD.length, 'metrics computed by the workbook itself — this portal shows these unchanged'],
]

export default function Settings() {
  const router = useRouter()
  const { role, setRole, can, why } = useRole()

  return (
    <div>
      <PageHeading
        title="Settings"
        subtitle="The thresholds every judgement on this portal is made against, where the data came from, and what is still open."
      />

      <Section title="Thresholds">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(238px,1fr))', gap: 12 }}>
          <Threshold
            name="Maximum penetration"
            value={THRESHOLDS.penetration.value}
            source={THRESHOLDS.penetration.label}
            note="A DOP/PAO integrity test above this fails and the record locks as flagged. ISO 14644-3 sets 0.01% for an installed-filter leak scan."
          />
          <Threshold
            name="Pressure differential breach"
            value={`${THRESHOLDS.pressureDifferential.value} in. wg`}
            source={THRESHOLDS.pressureDifferential.label}
            note="A reading above this is a breach and raises a work order. It says the filter is loading, not that the barrier has failed."
          />
          <Threshold
            name="Notification lead time"
            value={`${THRESHOLDS.notificationLeadDays.value} days`}
            source={THRESHOLDS.notificationLeadDays.label}
            note="Inside this window a certification is “due soon” and the reviewer is notified. Past the due date it escalates to the quality manager."
          />
        </div>
        <p style={styles.note}>
          All three are read from the workbook&apos;s Read Me sheet and applied
          everywhere — the registry, the notifications and the approvals queue read
          the same numbers. They are shown rather than editable on purpose: a
          threshold the screens can change is a threshold nobody can check the
          arithmetic against.
        </p>
      </Section>

      <Section title="Open question" style={{ borderColor: '#fde68a', background: '#fffdf7' }}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.2"
            strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#7c2d12' }}>
              Is the penetration column a percentage or a fraction?
            </h4>
            <p style={{ margin: 0, fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
              The DOP/PAO sheet labels its column <strong style={{ color: INK }}>Penetration (%)</strong>,
              while the threshold beside it is written as{' '}
              <strong style={{ color: INK }}>{THRESHOLDS.penetration.value}</strong> — which is the
              fraction form of the 0.01% that ISO 14644-3 sets. The rows are
              internally consistent either way: every Fail sits above the threshold
              and every Pass below it, so the pass rate is the same number under
              both readings.
            </p>
            <p style={{ margin: '9px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.65 }}>
              Only the label is ambiguous, so the portal carries the values{' '}
              <strong style={{ color: INK }}>exactly as the file holds them</strong> and raises this
              rather than multiplying by a hundred on a guess. One sentence from
              your quality team settles it, and nothing but the column label changes.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Calendar alignment">
        <Fields columns={2} rows={[
          ['Anchor point', <span key="a">{fmtDate(ANCHOR_SUMMARY.source)} — the workbook&apos;s most recent integrity test</span>],
          ['Read as', <span key="b">{fmtDate(ANCHOR_SUMMARY.today)} (today)</span>],
          ['Offset applied', <span key="c"><strong style={{ color: INK }}>+{ANCHOR_SUMMARY.offsetDays} days</strong>, recomputed on every load</span>],
          ['Workbook dates', 'Never overwritten — every record shows both'],
        ]} />
        <p style={styles.note}>{ANCHOR_NOTE}</p>
        <p style={{ ...styles.note, marginTop: 8, paddingTop: 0, borderTop: 'none' }}>
          The offset is a distance rather than a fixed number, so the calendar
          cannot go stale: it is correct next month and next year without anyone
          re-running the import. Every interval the workbook encodes is preserved
          exactly; only where today falls against them moves. <Derived />
        </p>
      </Section>

      <Section title="Where the data came from">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHEETS.map(([sheet, count, what]) => (
            <div key={sheet} style={styles.sheet}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: INK, minWidth: 178 }}>{sheet}</span>
              <span style={styles.count}>{count}</span>
              <span style={{ fontSize: 11.5, color: SUB, flex: '1 1 240px' }}>{what}</span>
            </div>
          ))}
        </div>
        <p style={styles.note}>
          Imported once by <code style={styles.code}>scripts/import-hepa-workbook.mjs</code> and
          committed as plain JavaScript, so there is no upload step and no
          spreadsheet to lose. The import cross-references every sheet — a test
          pointing at a filter that is not on the registry fails the import rather
          than reaching a screen.
        </p>
      </Section>

      <Section title="Checked against the workbook's own arithmetic">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '11px 18px' }}>
          {WORKBOOK_DASHBOARD.map((m) => (
            <div key={m.metric} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>
                {m.metric}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                {typeof m.value === 'number' && m.value > 0 && m.value < 1 ? pct(m.value) : m.value}
              </div>
              <div style={{ fontSize: 10.5, color: MUTE, marginTop: 2 }}>{m.source}</div>
            </div>
          ))}
        </div>
        <p style={styles.note}>
          Every figure on this list is the workbook&apos;s, and the import recomputes
          each one from the underlying rows and refuses to finish if they
          disagree. <FromWorkbook /> marks these wherever they appear; anything
          this portal works out for itself carries <Derived /> instead.
        </p>
      </Section>

      {/* ── roles, reachable from here too ──────────────────────────────
          Settings is where a person goes to ask "who can do what on this
          system", so the answer starts here rather than only living behind a
          menu entry of its own. The switcher is live: change role and the rest
          of the portal changes with it. The full matrix is one press away. */}
      <Section
        title="Roles & access"
        right={(
          <button onClick={() => router.push('/portal/hepa/access')} style={styles.open}>
            Open the full matrix
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          {ROLES.map((r) => {
            const on = r.id === role.id
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setRole(r.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRole(r.id) }}
                style={{ ...styles.roleCard, ...(on ? { borderColor: r.edge, background: r.tint } : null) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                  <span style={{ ...styles.roleAvatar, background: r.tint, color: r.accent, borderColor: r.edge }}>
                    {r.initials}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 12.5, color: INK }}>{r.name}</strong>
                    <span style={{ fontSize: 10.5, color: MUTE }}>{r.person}</span>
                  </span>
                  {on && (
                    <span style={{ ...styles.signedIn, color: r.accent, borderColor: r.edge }}>signed in</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>{r.what}</p>
              </div>
            )
          })}
        </div>

        <div style={styles.canRow}>
          <span style={styles.canLabel}>As {role.short}, you can</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GATED.map(([cap, label]) => {
              const yes = can(cap)
              return (
                <span key={cap} title={yes ? undefined : why(cap)}
                  style={{ ...styles.capChip, ...(yes ? styles.capYes : styles.capNo) }}>
                  {yes ? '✓' : '—'} {label}
                </span>
              )
            })}
          </div>
        </div>

        <p style={styles.note}>
          The three roles are the ones the workbook already routes records to,
          rather than a generic admin/editor/viewer ladder that would have to be
          mapped onto the organisation later. Nobody — no role at all — can edit
          a record once it is locked and audit-ready.
        </p>
      </Section>

      <Section title="This deployment">
        <Fields columns={2} rows={[
          ['Facility', `${ORG.name} — ${ORG.description}`],
          ['Site', ORG.site],
          ['System of record', ORG.cmms],
          ['Cleanrooms', `${CLEANROOMS.length} — ${CLEANROOMS.map((c) => c.isoClass).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`],
          ['Signed in as', `${USER.name} — ${USER.role}`],
          ['Record kinds written here', 'hepa_signature · hepa_audit · hepa_hold'],
        ]} />
        <Card style={{ marginTop: 13, background: '#fcfdfe', borderColor: LINE }}>
          <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>
            <strong style={{ color: INK }}>Dataset.</strong> {ORG.dataNote}
          </p>
        </Card>
      </Section>
    </div>
  )
}

function Threshold({ name, value, source, note }) {
  return (
    <div style={styles.threshold}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 }}>{name}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: ACCENT, margin: '5px 0 6px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.55, marginBottom: 7 }}>{note}</div>
      <div style={{ fontSize: 10.5, color: MUTE, paddingTop: 7, borderTop: `1px solid ${LINE}` }}>
        Read Me sheet: &ldquo;{source}&rdquo;
      </div>
    </div>
  )
}

const styles = {
  open: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px',
    fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 8,
    background: '#fff', color: ACCENT, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  roleCard: {
    padding: '12px 14px', borderRadius: 11, background: '#fcfdfe', cursor: 'pointer',
    userSelect: 'none', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  roleAvatar: {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
    borderStyle: 'solid', borderWidth: 1,
  },
  signedIn: {
    marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3,
    textTransform: 'uppercase', background: '#fff', borderRadius: 999, padding: '1px 7px',
    borderStyle: 'solid', borderWidth: 1, flexShrink: 0,
  },
  canRow: {
    display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap',
    marginTop: 14, paddingTop: 13, borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
  canLabel: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, flexShrink: 0,
  },
  capChip: {
    fontSize: 10.5, fontWeight: 600, borderRadius: 999, padding: '3px 9px',
    borderStyle: 'solid', borderWidth: 1, whiteSpace: 'nowrap',
  },
  capYes: { color: '#047857', background: '#f0fdf4', borderColor: '#bbf7d0' },
  capNo: { color: '#94a3b8', background: '#f8fafc', borderColor: '#e2e8f0' },
  note: {
    margin: '14px 0 0', paddingTop: 12, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.6,
  },
  threshold: {
    padding: '13px 15px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 11, background: '#fcfdfe',
  },
  sheet: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: '9px 12px', borderStyle: 'solid', borderWidth: 1, borderColor: `${LINE}`, borderRadius: 9, background: '#fcfdfe',
  },
  count: {
    fontSize: 11.5, fontWeight: 700, color: ACCENT, background: '#eef2ff',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 999, padding: '1px 9px', minWidth: 34, textAlign: 'center',
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11,
    background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, color: INK,
  },
}
