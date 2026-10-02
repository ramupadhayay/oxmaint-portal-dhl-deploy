'use client'

// The Safety & EHS block's front page.
//
// This half of the portal comes from a different source and started in a
// different state from the compliance half. The compliance sheets carry real
// permits, real obligations and two real deviations. The safety sheets carry a
// *form schema* — the fifteen fields of WAGA's own Safety Checklist — and no
// executed records at all. V-013: "No executed WAGA safety records were
// provided."
//
// So this screen said what each module would do and what it was waiting for,
// rather than showing four cards of invented completions. That was right, and
// it stopped being the whole truth the moment the modules became usable: an
// assessment can be filed, an isolation opened, an incident reported, a
// training recorded. A hub that still reads "deliberately empty" over a working
// module is worse than one that never claimed anything, because a reader
// believes it and does not go and look.
//
// So the distinction the screen now draws is the one that is actually true, and
// it is a sharper one than "empty or not": no *historical* safety record was
// supplied, and everything under here is what this trial has recorded since. A
// count of nought reads as nought filed, not as a module that does not work.

import { useRouter } from 'next/navigation'
import { Section, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Note, Blank } from '../components/cells'
import { safetyBySection, SAFETY_FIELDS, TRAINING } from '../lib/data'
import { useSite } from '../lib/siteStore'
import { useCreated } from '../lib/store'

const MODULES = [
  {
    key: 'pre-task',
    title: 'Pre-Task Safety / JSA',
    body: 'Work activity and location, general and specific risk selection, required PPE, training and permits, then a task → hazard → control matrix and crew sign-off.',
    items: ['Work activity + location', 'General and specific risks', 'Required PPE / training / permits', 'Task–hazard–control matrix', 'Crew acknowledgement + supervisor sign-off'],
    count: (c) => c.assessments.length,
    unit: 'assessment',
  },
  {
    key: 'loto',
    title: 'Permit to Work',
    body: 'Four permit types, issued conditionally on what the checklist selection turns up.',
    items: ['Hot Work', 'Confined Space', 'Energized Electrical', 'Critical Lift'],
    count: (c) => c.isolations.length,
    unit: 'permit',
  },
  {
    key: 'loto',
    title: 'LOTO',
    body: 'The repeatable lock record from pages 4–5 of the checklist, kept in the same structure the paper form uses. An isolation cannot be closed out until every lock on it is accounted for.',
    items: ['Electric / mechanical / process / inerting', 'Lock IDs and equipment tags', 'Valve positions', 'Try-out and removal verification', 'Re-inert and leak-test closeout'],
    count: (c) => c.isolations.filter((i) => !/closed/i.test(i.status || '')).length,
    unit: 'open isolation',
  },
  {
    key: 'incidents',
    title: 'Incident / RCA',
    // The distinction that survives: the General Incident Report workbook is
    // still not among the supplied files, so there is no *history* to show. The
    // module itself records and works an incident now, which is a different
    // statement and the one a reader needs.
    body: 'Reportable here and worked to closure. The General Incident Report workbook that carries RCA and OSHA Form 301 was not among the supplied files, so there is no history behind this — only what the trial records.',
    items: ['Report, investigate, close', 'Map RCA and OSHA 301 fields when the source arrives', 'Link CAPA to compliance deviations'],
    count: (c) => c.incidents.length,
    unit: 'incident',
  },
]

export default function Safety() {
  const router = useRouter()
  const go = (key) => router.push(`/portal/waga/${key}`)

  // Scoped, like every other screen: this one counted the whole trial's safety
  // records whatever site was selected in the header.
  const { scope, siteName } = useSite()
  const assessments = scope(useCreated('waga_jsa'))
  const isolations = scope(useCreated('waga_loto'))
  const incidents = scope(useCreated('waga_incident'))
  // Training is not scoped: a competency belongs to the person, and the matrix
  // is organisation-wide by design.
  const trainings = useCreated('waga_training')
  const counts = { assessments, isolations, incidents, trainings }

  const required = TRAINING.filter((t) => t.required).length
  const executed = assessments.length + isolations.length + incidents.length + trainings.length
  const openIncidents = incidents.filter((i) => !/closed/i.test(i.status || '')).length

  return (
    <div>
      <PageHeading
        title="Safety & EHS Overview"
        subtitle={`The WAGA Safety Checklist, digitised — what each workflow covers, and what has been filed against it. Scope: ${siteName}.`}
      />

      <StatCards items={[
        { label: 'Checklist fields', value: SAFETY_FIELDS.length, note: `${safetyBySection.length} sections`, to: 'pre-task', icon: 'list' },
        { label: 'Core workflows', value: 4, note: 'JSA · PTW · LOTO · closeout' },
        { label: 'Training requirements', value: TRAINING.length, note: `${required} mandatory`, to: 'training', icon: 'people' },
        { label: 'Records filed here', value: executed, note: executed ? 'Across all four workflows' : 'Nothing filed yet', tone: executed ? undefined : 'amber' },
        { label: 'Open incidents', value: openIncidents, note: incidents.length ? `${incidents.length} reported in this scope` : 'None reported', tone: openIncidents ? 'amber' : 'green', to: 'incidents' },
      ]} onCardClick={go} />

      <Note tone={executed ? 'grey' : 'warn'}>
        WAGA supplied the blank Safety Checklist and no completed one, so every form below is
        modelled field for field from that schema and nothing was invented to fill the gap.
        {executed
          ? <> The {executed} record{executed === 1 ? '' : 's'} under here {executed === 1 ? 'is' : 'are'} what
            this trial has filed since — none of it came with the source files.</>
          : <> Nothing has been filed against them yet.</>}
      </Note>

      <Section title="Recommended trial scope">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
          {MODULES.map((m) => (
            <div key={m.title} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{m.title}</h3>
                <button onClick={() => go(m.key)} style={link}>Open →</button>
              </div>
              {/* What is in it, on the card. A hub whose cards all read the same
                  whether a module has been used forty times or never is a hub
                  that has to be clicked through to be read. */}
              <div style={{ marginTop: 8 }}>
                <StatusBadge tone={m.count(counts) ? 'blue' : 'grey'}>
                  {m.count(counts)} {m.unit}{m.count(counts) === 1 ? '' : 's'}
                </StatusBadge>
              </div>
              <p style={{ margin: '7px 0 0', fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>{m.body}</p>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#64748b', fontSize: 12, lineHeight: 1.75 }}>
                {m.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Checklist structure" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>From the supplied Safety Checklist PDF</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          {safetyBySection.map((s) => (
            <div key={s.section} style={{ padding: '11px 13px', background: '#f8fafc', border: '1px solid #eef1f6', borderRadius: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{s.section}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {s.fields.length} field{s.fields.length === 1 ? '' : 's'} · page {[...new Set(s.fields.map((f) => f.sourcePage))].join(', ')}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

const card = { padding: '14px 16px', border: '1px solid #e4e9f0', borderRadius: 12, background: '#fff' }
const link = { background: 'none', border: 'none', color: '#15227a', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, whiteSpace: 'nowrap' }
