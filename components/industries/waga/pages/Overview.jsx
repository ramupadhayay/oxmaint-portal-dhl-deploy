'use client'

// The screen that answers "where do we stand", and the only one that reads
// across every sheet in the workbook — and now across everything the portal has
// been used to record.
//
// Its numbers are counted from the data rather than written down, so the
// headline figures and the registers a reader drills into can never disagree.
// The supplied mockup hard-coded "Tracked Permits 7" against a workbook that
// carries eight — the Chapter 105 permit was added by the verification pass and
// the mockup was never updated. Counting is what stops that happening again.
//
// The same rule is why this screen had to change once the registers became
// writable. A deviation raised here, a filing completed on the calendar, an
// incident reported — all of it was invisible to the one screen a manager opens
// to ask whether anything needs them. "Open deviations: 1" while the register
// underneath showed three is exactly the disagreement the counting was meant to
// prevent, arriving through the back door.

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, SiteChip, TwoLine, DateVal, Derived, Note, Blank } from '../components/cells'
import { useSite } from '../lib/siteStore'
import {
  ORG, permits, requirements, deviations, parameters,
  permitHealth, isNonExpiring, fmtDate, daysUntil,
} from '../lib/data'
import { generateOccurrences, nextPerRequirement, kindOf, KIND } from '../lib/schedule'
import { useRecords, useCreated } from '../lib/store'

const devId = (d) => d.deviationId

export default function Overview() {
  const router = useRouter()
  const { scope, siteName, visibleSites, sites } = useSite()
  const go = (key) => router.push(`/portal/waga/${key}`)

  // Deviations merged the way the deviations register merges them — one
  // helper, so a deviation raised there is open here too and a CAPA closed
  // there stops being counted here.
  const allDevs = useRecords('waga_deviation', deviations, devId)
  const allRequirements = useRecords('waga_requirement', requirements, (r) => r.requirementId)
  // Permits merged the same way, which they were not: this screen read the
  // workbook alone, so a permit added in the portal — the only kind a site
  // added in the portal can have — was missing from the first screen anybody
  // opens.
  const allPermits = useRecords('waga_permit_event', permits, (p) => p.permitId)
  // Everything created in the portal follows the scope too. Counting another
  // site's isolations under this one is not a rounding error on a compliance
  // screen.
  const filings = scope(useCreated('waga_filing'))
  const readings = scope(useCreated('waga_reading'))
  const incidents = scope(useCreated('waga_incident'))
  const assessments = scope(useCreated('waga_jsa'))
  const isolations = scope(useCreated('waga_loto'))
  const trainings = scope(useCreated('waga_training'))

  const myPermits = useMemo(() => scope(allPermits), [scope, allPermits])
  const myReqs = useMemo(() => scope(allRequirements), [scope, allRequirements])
  const myDevs = useMemo(() => scope(allDevs), [scope, allDevs])
  const myOpenDevs = useMemo(() => myDevs.filter((d) => d.status !== 'Closed'), [myDevs])
  const openIncidents = useMemo(() => incidents.filter((i) => !/closed/i.test(i.status || '')), [incidents])

  // The calendar, computed the same way the calendar screen computes it — one
  // function, so the count in the card is the count in the table.
  // Filed occurrences drop out. A calendar entry somebody completed this
  // morning is not work that still has to be done, and leaving it in the count
  // is how a manager is told to chase something already filed.
  const filedIds = useMemo(() => new Set(filings.map((f) => f.occurrenceId).filter(Boolean)), [filings])

  const upcoming = useMemo(() => {
    const occ = generateOccurrences(myReqs, allPermits).filter((o) => !filedIds.has(o.occurrenceId))
    return nextPerRequirement(occ).filter((o) => o.daysUntil <= 120)
  }, [myReqs, allPermits, filedIds])

  const standing = myReqs.filter((r) => kindOf(r) === KIND.CONTINUOUS).length
  const eventDriven = myReqs.filter((r) => kindOf(r) === KIND.EVENT).length

  // Anything with a renewal or expiry inside six months, which is the window a
  // renewal application actually has to be prepared in.
  const renewalWatch = myPermits.filter((p) => {
    const watch = p.renewalDeadline || p.expirationDate
    const d = daysUntil(watch)
    return d !== null && d >= 0 && d <= 400
  })

  // The sites actually in scope, so the "Trial sites" card names the site being
  // looked at rather than always reciting both states. With WBU07 selected it
  // reads "IA · Scott Area", not "PA · IA".
  // Read off the scope itself. Inferred from the permits, it counted the sites
  // that hold one — so a site added in the portal, which holds none until a
  // permit is written for it, reported the estate as having no sites at all.
  const scopedSites = visibleSites
  const trialSitesNote = scopedSites.length === 1
    ? `${scopedSites[0].state} · ${siteArea(scopedSites[0])}`
    : (scopedSites.length ? [...new Set(scopedSites.map((s) => s.state))].join(' · ') : ORG.states.join(' · '))

  const stats = [
    { label: 'Trial sites', value: scopedSites.length, note: trialSitesNote, icon: 'site' },
    { label: 'Tracked permits', value: myPermits.length, note: [...new Set(myPermits.map((p) => p.agency))].join(' · '), to: 'permits' },
    { label: 'Obligations', value: myReqs.length, note: `${standing} standing · ${eventDriven} event-driven`, to: 'requirements', icon: 'list' },
    {
      label: 'Due in 120 days',
      value: upcoming.length,
      tone: upcoming.some((o) => o.daysUntil < 0) ? 'amber' : undefined,
      note: filedIds.size ? `${filedIds.size} filed and cleared` : 'Derived from recurrence rules',
      to: 'calendar',
      icon: 'clock',
    },
    {
      label: 'Open deviations',
      value: myOpenDevs.length,
      tone: myOpenDevs.length ? 'amber' : 'green',
      note: `${myDevs.length} recorded in total`,
      to: 'deviations',
    },
    {
      label: 'Open incidents',
      value: openIncidents.length,
      tone: openIncidents.length ? 'amber' : 'green',
      note: incidents.length ? `${incidents.length} reported in this scope` : 'None reported',
      to: 'incidents',
      icon: 'alert',
    },
  ]

  // What the trial has actually produced, as opposed to what was supplied with
  // it. Kept as its own strip rather than mixed into the headline: a permit
  // count is the estate, and these are the evidence that the estate is being
  // worked. A reader deciding whether the trial is being used needs the second
  // number, and it did not exist on this screen before.
  const activity = [
    { label: 'Filings completed', value: filedIds.size, to: 'calendar' },
    { label: 'Readings logged', value: readings.length, to: 'parameters' },
    { label: 'Deviations raised', value: myDevs.filter((d) => d._createdAt).length, to: 'deviations' },
    { label: 'Assessments filed', value: assessments.length, to: 'pre-task' },
    { label: 'Isolations opened', value: isolations.length, to: 'loto' },
    { label: 'Training recorded', value: trainings.length, to: 'training' },
  ]
  const activityTotal = activity.reduce((n, a) => n + a.value, 0)

  return (
    <div>
      <PageHeading
        title="Compliance Overview"
        // "two trial sites" was written when there were two. A site added in
        // the portal makes it three, and a subtitle that keeps saying two is
        // the kind of small untruth a client notices first.
        subtitle={`Permit obligations, deadlines, monitoring limits and compliance evidence across ${ORG.name}'s ${sites.length} ${sites.length === 1 ? 'site' : 'sites'} — ${siteName}.`}
      />

      <StatCards items={stats} onCardClick={go} />

      {activityTotal > 0 && (
        <Section
          title="Recorded in this trial"
          right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Created in the portal, not supplied with it</span>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {activity.map((a) => (
              <button key={a.label} onClick={() => go(a.to)} style={tile} disabled={!a.value}>
                <div style={{ fontSize: 20, fontWeight: 700, color: a.value ? '#15227a' : '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                  {a.value}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, fontWeight: 600 }}>{a.label}</div>
              </button>
            ))}
          </div>
        </Section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)', gap: 14 }}>
        <Section
          title="Upcoming compliance work"
          right={<button onClick={() => go('calendar')} style={link}>Full calendar →</button>}
        >
          <Note tone="grey">
            Every date below is worked out from the frequency and deadline written on the
            requirement — not a completion WAGA recorded. The workbook has no completion
            history in it at all.
          </Note>

          <DataTable
            pageSize={8}
            rows={upcoming}
            onRowClick={() => go('calendar')}
            empty="No obligations fall due in the next 120 days for this site."
            columns={[
              {
                key: 'dueDate', label: 'Due', width: 130,
                render: (o) => (
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: o.daysUntil < 0 ? '#b91c1c' : '#0f172a' }}>
                      {fmtDate(o.dueDate)}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                      {o.daysUntil < 0 ? `${Math.abs(o.daysUntil)} days ago` : `in ${o.daysUntil} days`}
                    </div>
                  </div>
                ),
              },
              {
                key: 'title', label: 'Obligation',
                render: (o) => <TwoLine top={o.title} bottom={`${o.category} · ${o.frequency}`} />,
              },
              { key: 'siteId', label: 'Site', width: 80, render: (o) => <SiteChip code={o.siteId.replace('SITE-', '')} /> },
              { key: 'status', label: 'Status', width: 108, render: (o) => <StatusBadge>{o.status === 'Past due' ? 'Overdue' : o.status === 'Due soon' ? 'Pending' : 'Scheduled'}</StatusBadge> },
            ]}
          />
        </Section>

        <div>
          <Section title="Permit health" right={<button onClick={() => go('permits')} style={link}>All permits →</button>}>
            {myPermits.map((p) => {
              const h = permitHealth(p)
              const watch = p.renewalDeadline || p.expirationDate
              return (
                <div key={p.permitId} style={row}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', lineHeight: 1.35 }}>{p.permitType}</div>
                      <div style={{ marginTop: 3 }}><Ref>{p.permitNumber}</Ref></div>
                    </div>
                    <StatusBadge tone={h.tone}>{h.label}</StatusBadge>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 5 }}>
                    {p.renewalDeadline
                      ? <>Renewal application due <DateVal value={p.renewalDeadline} /></>
                      : p.expirationDate
                        ? <>Expires <DateVal value={p.expirationDate} /></>
                        : <Blank label={isNonExpiring(p) ? 'Non-expiring' : 'No expiry date in the source'} />}
                  </div>
                </div>
              )
            })}
          </Section>

          {myOpenDevs.length > 0 && (
            <Section title="Open deviations" right={<button onClick={() => go('deviations')} style={link}>All →</button>}>
              {myOpenDevs.map((d) => (
                <div key={d.deviationId} style={row}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <Ref>{d.deviationId}</Ref>
                    <StatusBadge tone="amber">{d.status}</StatusBadge>
                  </div>
                  <div style={{ fontSize: 12, color: '#0f172a', marginTop: 5, lineHeight: 1.45 }}>{d.description}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Event <DateVal value={d.eventDate} /> · {d._siteCode}
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>

      <Section title="What this trial covers">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
          {[
            ['Sites', `${ORG.siteCount} RNG facilities across ${ORG.states.join(' and ')}`],
            ['Agencies', ORG.agencies.join(', ')],
            ['Obligations', `${ORG.requirementCount} requirements across ${new Set(requirements.map((r) => r.category)).size} categories`],
            ['Limits tracked', `${parameters.length} permit limits and operating parameters`],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #eef1f6', borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{k}</div>
              <div style={{ fontSize: 13, color: '#0f172a', marginTop: 6, lineHeight: 1.5 }}>{v}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// The place-name a site is known by — "Scott Area RNG Facility" → "Scott Area".
const siteArea = (s) => ((s.siteName || '').replace(/\s*RNG\s*(Facility|Plant)?\s*$/i, '').trim() || s.city || s.code)

const link = { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }
const tile = {
  padding: '12px 13px', border: '1px solid #e4e9f0', borderRadius: 11,
  background: '#fff', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  cursor: 'pointer',
}
const row = { padding: '11px 0', borderBottom: '1px solid #eef1f6' }
