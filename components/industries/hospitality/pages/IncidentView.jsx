'use client'

// One incident, on its own page.
//
// The register is short and should be. What matters about any single entry is
// not that it is filed but that it can be produced: the ones that become a claim
// or an insurer's question turn up months later, and by then the whole defence
// is what was written down at the time and what was done about it.
//
// So the page is built around three things — what happened, how long it stayed
// open, and the corrective action — rather than around the fields.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  PageHeading, StatCards, Section, Card, Fields,
  StatusBadge, ActionButton, PALETTE,
} from '../lib/kit'
import { INCIDENTS, fmtDate, daysUntil } from '../lib/data'

const { INK, SUB, MUTE } = PALETTE

const sevTone = (s) => (s === 'High' ? 'red' : s === 'Medium' ? 'amber' : 'grey')
const statusTone = (s) => (s === 'Closed' ? 'green' : s === 'Open' ? 'amber' : 'blue')

const days = (from, to) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)

export default function IncidentView({ section, id }) {
  const router = useRouter()

  const inc = useMemo(
    () => INCIDENTS.find((i) => i.incident_id === String(id) || i.incident_number === String(id)) || null,
    [id]
  )

  if (!inc) return <NotHere reference={id} router={router} />

  const closed = Boolean(inc.closed_date)
  // Closed: how long it took. Open: how long it has been, which is the number
  // that matters while it is still the property's exposure.
  const toClose = closed ? days(inc.reported_date, inc.closed_date) : Math.abs(daysUntil(inc.reported_date))
  const guestSafety = inc.category === 'Guest safety'

  return (
    <div>
      <PageHeading
        title={inc.incident_number}
        subtitle={inc.title}
        back={{ label: 'Incidents', onClick: () => router.push('/portal/hospitality/incidents') }}
        right={<StatusBadge tone={statusTone(inc.status)}>{inc.status}</StatusBadge>}
      />

      <StatCards items={[
        {
          label: 'Severity',
          value: inc.severity,
          tone: inc.severity === 'High' ? 'red' : inc.severity === 'Medium' ? 'amber' : undefined,
          note: inc.category,
        },
        {
          label: closed ? 'Days to close' : 'Open for',
          value: toClose,
          unit: toClose === 1 ? 'day' : 'days',
          tone: closed ? 'green' : toClose > 14 ? 'red' : 'amber',
          note: closed ? `closed ${fmtDate(inc.closed_date)}` : 'still on the register',
        },
        {
          label: 'Where',
          value: inc.location_name,
          note: 'as recorded at the time',
        },
        {
          label: 'Reported',
          value: fmtDate(inc.reported_date),
          note: `by ${inc.reported_by}`,
        },
      ]} />

      {guestSafety && (
        <Card style={{ marginBottom: 14, background: '#fef2f2', borderColor: '#fecaca' }}>
          <div style={{ fontSize: 12.5, color: '#b91c1c', lineHeight: 1.6 }}>
            A guest safety incident. These are the entries that come back as a claim, and the
            file as it stands today — the dates, who recorded it, what was done — is what
            answers it{closed ? '.' : ', which is why one still open is worth closing out properly rather than quietly.'}
          </div>
        </Card>
      )}

      <div style={styles.two}>
        <Section title="What happened" style={{ marginBottom: 0 }}>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: INK, lineHeight: 1.6 }}>{inc.title}</p>
          <Fields rows={[
            ['Status', <StatusBadge key="s" tone={statusTone(inc.status)}>{inc.status}</StatusBadge>],
            ['Category', <StatusBadge key="c" tone={guestSafety ? 'red' : 'grey'}>{inc.category}</StatusBadge>],
            ['Severity', <StatusBadge key="v" tone={sevTone(inc.severity)}>{inc.severity}</StatusBadge>],
            ['Location', inc.location_name],
            ['Reported by', inc.reported_by],
            ['Reported', fmtDate(inc.reported_date)],
            ['Closed', closed ? fmtDate(inc.closed_date) : 'Not yet'],
            [closed ? 'Days to close' : 'Days open', toClose],
          ]} />
        </Section>

        <Section title="Corrective action" style={{ marginBottom: 0 }}>
          <p style={{ margin: 0, fontSize: 13, color: SUB, lineHeight: 1.6 }}>{inc.corrective_action}</p>

          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
            {closed
              ? 'Closed entries are the ones that answer a question later. The corrective action is the line an insurer or a brand auditor reads first — it is what says the property responded rather than only noticed.'
              : 'Open until the corrective action is recorded and signed off. An incident that stays under investigation is a gap in the file, not a neutral state.'}
          </p>
        </Section>
      </div>

      {/* Carried over from the register, and it belongs here more than there:
          this is the page somebody would screenshot. Illustrative records must
          not be mistaken for the property's own incident file. */}
      <Card>
        <p style={{ margin: 0, fontSize: 11.5, color: MUTE, lineHeight: 1.55 }}>
          An illustrative record for the demo. A real incident file carries statements,
          photographs and dates that matter legally — this shows the shape of the register,
          not a substitute for the property&rsquo;s own reporting process.
        </p>
      </Card>
    </div>
  )
}

function NotHere({ reference, router }) {
  return (
    <Card style={{ maxWidth: 560 }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>Nothing here with that reference</h1>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: SUB, lineHeight: 1.6 }}>
        <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{String(reference)}</code> is not
        an incident on this register.
      </p>
      <div style={{ marginTop: 16 }}>
        <ActionButton onClick={() => router.push('/portal/hospitality/incidents')}>Back to the incidents</ActionButton>
      </div>
    </Card>
  )
}

const styles = {
  two: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14, alignItems: 'start' },
}
