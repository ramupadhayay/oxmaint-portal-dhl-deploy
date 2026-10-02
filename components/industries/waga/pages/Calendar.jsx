'use client'

// The compliance calendar — every dated obligation, worked out from the rules,
// and the place they are marked filed.
//
// The workbook ships seven task rows and five of them are labelled
// "Demo-generated from source frequency". Its Verification_Log is explicit
// about what to do with them: "Do NOT import these as historical WAGA
// completions; generate dynamically after rules are configured." So this screen
// does not read Compliance_Tasks for its live calendar. It runs the register
// through lib/schedule.js and shows what the rules imply, every row marked
// derived.
//
// What makes it the "live filing calendar" the trial was sold on: each generated
// occurrence can be marked filed. That completion is a record — filed date, by
// whom, and the reference to the evidence held for it — laid over the derived
// date, never merged into it. The occurrence is still the portal's arithmetic;
// the filing is the one thing WAGA actually did, and the two stay distinct the
// way the workbook's README keeps the recurring rule distinct from the
// completion against it.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { SiteChip, TwoLine, Note, Blank } from '../components/cells'
import FilingModal from '../components/FilingModal'
import EvidenceViewer from '../components/EvidenceViewer'
import { useSite } from '../lib/siteStore'
import { useStore, useCreated, useRecords, USER } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import { recordFiling, attachmentsByFiling } from '../lib/filing'
import { requirements, permits, fmtDate } from '../lib/data'
import { generateOccurrences, nextPerRequirement } from '../lib/schedule'

const HORIZONS = ['Next 30 days', 'Next 90 days', 'Next 12 months', 'Everything generated']
const WINDOW = { 'Next 30 days': 30, 'Next 90 days': 90, 'Next 12 months': 365, 'Everything generated': 100000 }

export default function Calendar() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const store = useStore()
  // Scoped, so the filed list and the activity panel below carry this site's
  // filings. The occurrence join is unaffected: occurrences are generated
  // from obligations that are already scoped.
  const filingRows = scope(useCreated('waga_filing'))
  const allRequirements = useRecords('waga_requirement', requirements, (r) => r.requirementId)
  // Metadata only — the API keeps attachment payloads out of the bulk load, so
  // this is what lets a row say "2 files" without fetching either of them.
  const attachmentRows = useCreated('waga_attachment')
  const attachedTo = useMemo(() => attachmentsByFiling(attachmentRows), [attachmentRows])

  const [search, setSearch] = useState('')
  const [horizon, setHorizon] = useState('Next 90 days')
  const [mode, setMode] = useState('Next occurrence only')
  const [show, setShow] = useState('Outstanding only')
  const [filing, setFiling] = useState(null)          // the occurrence being filed
  const [viewing, setViewing] = useState(null)        // the filing whose evidence is open

  const myReqs = useMemo(() => scope(allRequirements), [scope, allRequirements])
  const occurrences = useMemo(() => generateOccurrences(myReqs, permits), [myReqs])

  // Which occurrences have a filing against them. Keyed by the occurrence's own
  // stable id (requirement@date), so a filing sticks to exactly the date it was
  // recorded for and not the next projection of the same rule.
  const filedBy = useMemo(() => {
    const m = new Map()
    for (const f of filingRows) if (f.occurrenceId) m.set(f.occurrenceId, f)
    return m
  }, [filingRows])

  const withState = useMemo(() => occurrences.map((o) => {
    const filed = filedBy.get(o.occurrenceId) || null
    return { ...o, filed, _status: filed ? 'Filed' : o.status }
  }), [occurrences, filedBy])

  const rows = useMemo(() => {
    const base = mode === 'Next occurrence only' ? nextPerRequirement(withState) : withState
    const days = WINDOW[horizon] ?? 90
    const q = search.trim().toLowerCase()
    return base.filter((o) => (
      o.daysUntil <= days
      && (show === 'All' || (show === 'Filed only' ? o.filed : !o.filed))
      && (!q || [o.title, o.category, o.rule, o.submissionMethod].join(' ').toLowerCase().includes(q))
    ))
  }, [withState, mode, horizon, search, show])

  // Counts are over outstanding occurrences — a filed one is neither overdue nor
  // due soon, because it is done.
  const outstanding = withState.filter((o) => !o.filed)
  const overdue = outstanding.filter((o) => o.daysUntil < 0).length
  const soon = outstanding.filter((o) => o.daysUntil >= 0 && o.daysUntil <= 30).length
  const filedCount = new Set(filingRows.map((f) => f.occurrenceId)).size

  return (
    <div>
      <PageHeading
        title="Regulatory Filing & Compliance Calendar"
        subtitle={`Recurring and milestone obligations, projected from the frequency and deadline written on each requirement, and marked filed as the work is done — ${siteName}.`}
      />

      <StatCards items={[
        { label: 'Occurrences shown', value: rows.length, note: horizon.toLowerCase(), icon: 'clock' },
        { label: 'Outstanding & overdue', value: overdue, tone: overdue ? 'amber' : 'green' },
        { label: 'Due within 30 days', value: soon, tone: soon ? 'amber' : undefined },
        { label: 'Filed this trial', value: filedCount, tone: filedCount ? 'green' : undefined, note: 'Recorded in the portal', icon: 'check' },
        { label: 'Rules projected', value: new Set(occurrences.map((o) => o.requirementId)).size, note: 'Of the register', icon: 'list' },
      ]} />

      <Section title="Generated schedule">
        <Note>
          Every date here is this portal&apos;s arithmetic over the recurrence rule, not a
          record WAGA entered. Marking a row <b>filed</b> records that the obligation was met —
          the filing date, who filed it, and the evidence reference — against that occurrence.
          The projected date is never overwritten; the two are kept apart.
        </Note>

        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search obligation or deadline rule…"
          filters={[
            { label: 'Horizon', value: horizon, onChange: setHorizon, options: HORIZONS },
            { label: 'Show', value: mode, onChange: setMode, options: ['Next occurrence only', 'Every occurrence'] },
            { label: 'State', value: show, onChange: setShow, options: ['Outstanding only', 'Filed only', 'All'] },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          onRowClick={(o) => router.push(`/portal/waga/requirements/${o.requirementId}`)}
          empty={show === 'Filed only' ? 'Nothing has been filed in this window yet.' : 'Nothing falls due in this window for this site.'}
          columns={[
            {
              key: 'dueDate', label: 'Due', width: 140,
              render: (o) => (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: o.filed ? '#0f172a' : o.daysUntil < 0 ? '#b91c1c' : '#0f172a' }}>{fmtDate(o.dueDate)}</div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                    {o.filed ? `filed ${fmtDate(o.filed.filedDate)}` : o.daysUntil < 0 ? `${Math.abs(o.daysUntil)} days ago` : `in ${o.daysUntil} days`}
                  </div>
                </div>
              ),
            },
            {
              key: 'title', label: 'Obligation',
              render: (o) => <TwoLine top={o.title} bottom={`${o.category} · ${o.frequency}`} />,
            },
            { key: 'siteId', label: 'Site', width: 78, render: (o) => <SiteChip code={o.siteId.replace('SITE-', '')} /> },
            {
              key: 'submissionMethod', label: 'Submitted to', width: 170,
              render: (o) => (o.submissionMethod ? <span style={{ fontSize: 12, color: '#475569' }}>{o.submissionMethod}</span> : <Blank />),
            },
            {
              key: 'status', label: 'Status', width: 120,
              render: (o) => (o.filed
                ? <StatusBadge tone="green">Filed</StatusBadge>
                : <StatusBadge tone={o.daysUntil < 0 ? 'red' : o.daysUntil <= 30 ? 'amber' : 'blue'}>{o.status}</StatusBadge>),
            },
            {
              key: 'act', label: '', width: 128, sortable: false,
              render: (o) => (
                <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
                  {o.filed ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: '#64748b' }}>
                        by {o.filed.filedBy || USER.name}
                      </span>
                      {(attachedTo.get(o.filed.recordId)?.length || 0) > 0 && (
                        <ActionButton size="sm" variant="subtle" onClick={() => setViewing(o.filed)}>
                          {attachedTo.get(o.filed.recordId).length} file
                          {attachedTo.get(o.filed.recordId).length === 1 ? '' : 's'}
                        </ActionButton>
                      )}
                    </span>
                  ) : (
                    <ActionButton size="sm" variant="subtle" onClick={() => setFiling(o)}>Mark filed</ActionButton>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Section>

      {/* Every filing marked from this calendar — when, what, the evidence and
          the note — not just the "Filed" badge on the occurrence. */}
      <ModuleActivity
        module="calendar"
        filings={filingRows}
        title="Filings recorded in the portal"
        empty="Nothing has been filed yet. Use File on any occurrence above."
      />

      <FilingModal
        subject={filing}
        onClose={() => setFiling(null)}
        onFile={async ({ payload, files }) => {
          const done = await recordFiling(store, {
            payload,
            files,
            audit: {
              action: 'Filed obligation',
              subject: `${payload.title} (${payload.siteCode})`,
              detail: `Due ${fmtDate(payload.dueDate)}`,
            },
          })
          if (done) {
            store.notify(`Filed — ${payload.title}.`)
            setFiling(null)
          }
        }}
      />

      <EvidenceViewer
        filing={viewing}
        attachments={viewing ? (attachedTo.get(viewing.recordId) || []) : []}
        onClose={() => setViewing(null)}
      />
    </div>
  )
}
