'use client'

// The obligation register — the largest table in the dataset and the one the
// supplied mockup had no screen for.
//
// Thirty-four requirements is what the eight permits actually oblige WAGA to
// do, and it is the table a compliance manager is accountable against. The
// mockup showed the permits and the calendar but not this, which left the
// portal able to say what is due on Thursday and not able to say what the
// permit requires.
//
// Grouped by the four kinds the schedule engine sorts them into rather than by
// sheet order, because the kinds answer different questions. Nine of these are
// standing obligations — record gas flow every fifteen minutes, confirm flame
// presence continuously — and they never appear on a calendar. Presenting them
// beside dated work, with no distinction, is how a reader concludes that a
// continuous recording duty was missed on the days it has no row.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, Toolbar, StatusBadge, ActionButton, Modal } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, SiteChip, TwoLine, Blank, Note, DateVal } from '../components/cells'
import FilingModal from '../components/FilingModal'
import EvidenceViewer from '../components/EvidenceViewer'
import { useSite } from '../lib/siteStore'
import { requirements, FREQUENCIES, fmtDate, permits } from '../lib/data'
import { useCreated, useRecords, useStore } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import { recordFiling, attachmentsByFiling } from '../lib/filing'
import { generateOccurrences, kindOf, KIND, KIND_LABEL } from '../lib/schedule'
import { requirementKey } from '../lib/keys'

const KIND_TONE = { recurring: 'blue', milestone: 'violet', continuous: 'green', event: 'amber' }

export default function Requirements() {
  const router = useRouter()
  const { scope, siteName, emptyFor } = useSite()
  const store = useStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [frequency, setFrequency] = useState('all')
  const [kind, setKind] = useState('all')
  const [filing, setFiling] = useState(null)
  const [viewing, setViewing] = useState(null)
  // The header's "Record filing": choose the obligation first, then file it.
  const [picking, setPicking] = useState(false)

  const allRequirements = useRecords('waga_requirement', requirements, requirementKey)

  // What has been filed, grouped by the obligation it answers. The calendar
  // writes the requirement id onto every filing, so this is a join that already
  // existed and simply had nobody reading it — which meant the register could
  // say what thirty-four obligations require and not which of them anyone had
  // evidenced.
  // Scoped: the card read every filing in the trial, so a site with nothing
  // filed against it still said "1 filing recorded".
  const filings = scope(useCreated('waga_filing'))
  const attachmentRows = useCreated('waga_attachment')
  const attachedTo = useMemo(() => attachmentsByFiling(attachmentRows), [attachmentRows])
  const filedBy = useMemo(() => {
    const m = new Map()
    for (const f of filings) {
      if (!f.requirementId) continue
      const list = m.get(f.requirementId) || []
      list.push(f)
      m.set(f.requirementId, list)
    }
    for (const list of m.values()) list.sort((a, b) => String(b.filedDate || '').localeCompare(String(a.filedDate || '')))
    return m
  }, [filings])

  const all = useMemo(() => scope(allRequirements).map((r) => {
    const mine = filedBy.get(r.requirementId) || []
    return {
      ...r,
      _kind: kindOf(r),
      _filings: mine,
      _lastFiled: mine[0] || null,
      _late: mine.filter((f) => f.dueDate && f.filedDate && f.filedDate > f.dueDate).length,
    }
  }), [scope, allRequirements, filedBy])

  // Only the obligations that can be evidenced by a filing. A standing duty —
  // record gas flow every fifteen minutes — is never filed against, so counting
  // it as unevidenced would make the number read worse than the truth.
  const filable = all.filter((r) => r._kind === KIND.RECURRING || r._kind === KIND.MILESTONE)
  const evidenced = filable.filter((r) => r._filings.length)

  // Categories present in the rows on screen, not across both sites. WBU07's
  // twelve obligations cannot span the fourteen categories the whole trial has,
  // and the card said fourteen because it counted the unscoped list.
  const scopedCategories = useMemo(
    () => [...new Set(all.map((r) => r.category))].filter(Boolean).sort(),
    [all],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((r) => (
      (category === 'all' || r.category === category) &&
      (frequency === 'all' || r.frequency === frequency) &&
      (kind === 'all' || KIND_LABEL[r._kind] === kind) &&
      (!q || [r.name, r.category, r.deadlineRule, r.submissionMethod, r._permitNumber, r.requirementId]
        .join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, category, frequency, kind])

  const count = (k) => all.filter((r) => r._kind === k).length

  /**
   * What a click on "Record filing" is answering.
   *
   * For a dated obligation it is the earliest outstanding occurrence — the thing
   * a compliance manager means when they say they have filed a quarterly report.
   * For an obligation with no projected date (standing, event-driven, or a
   * recurring rule that names no month) there is nothing to be measured against,
   * so the filing is recorded on the obligation itself. The modal says which of
   * the two it is; nothing here invents a date to make the first case apply.
   */
  const subjectFor = (r) => {
    const dated = r._kind === KIND.RECURRING || r._kind === KIND.MILESTONE
    if (dated) {
      const answered = new Set(r._filings.map((f) => f.occurrenceId).filter(Boolean))
      const next = generateOccurrences([r], permits).find((o) => !answered.has(o.occurrenceId))
      if (next) return { ...next, _siteCode: r._siteCode, frequency: r.frequency }
    }
    return r
  }

  return (
    <div>
      <PageHeading
        title="Requirements Register"
        subtitle={`Every obligation the trial permits impose, with its frequency, deadline rule, submission route and retention period — ${siteName}.`}
        // The same door "New permit" is on the permits screen. Filing used to
        // start only from a row, which meant finding the row first in a
        // thirty-four-line table; from here the obligation is chosen by
        // reference or by name, and the filing then opens exactly as the row's
        // button opens it.
        right={<ActionButton onClick={() => setPicking(true)}>Record filing</ActionButton>}
      />

      <StatCards items={[
        { label: 'Obligations', value: all.length, note: `${scopedCategories.length} categories`, icon: 'list' },
        { label: 'Scheduled', value: count(KIND.RECURRING), note: 'Recur on a calendar', icon: 'clock' },
        { label: 'Standing', value: count(KIND.CONTINUOUS), tone: 'green', note: 'Continuous or every 15 min' },
        { label: 'Event-driven', value: count(KIND.EVENT), tone: 'amber', note: 'Triggered, not dated' },
        { label: 'Milestones', value: count(KIND.MILESTONE), note: 'Renewals' },
        {
          label: 'Evidenced',
          value: `${evidenced.length} / ${filable.length}`,
          tone: evidenced.length ? 'green' : undefined,
          note: filings.length ? `${filings.length} filing${filings.length === 1 ? '' : 's'} recorded` : 'Nothing filed yet',
          icon: 'tick',
        },
      ]} />

      <Section title="Obligation register">
        <Note>
          <b>Standing</b> obligations have no due date by nature — they are continuous duties,
          and the question is whether the recording system is up, not what is due this week.
          <b> Event-driven</b> obligations have no date until the event happens. Only
          <b> scheduled</b> and <b> milestone</b> rows reach the compliance calendar.
        </Note>

        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search obligation, deadline rule or permit…"
          filters={[
            { label: 'Kind', value: kind, onChange: setKind, options: Object.values(KIND_LABEL) },
            { label: 'Category', value: category, onChange: setCategory, options: scopedCategories },
            { label: 'Frequency', value: frequency, onChange: setFrequency, options: FREQUENCIES },
          ]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          onRowClick={(r) => router.push(`/portal/waga/requirements/${r.requirementId}`)}
          empty={all.length
            ? 'No obligations match these filters.'
            : emptyFor('No obligations match these filters.', 'obligations',
              'Add obligation on a permit — open the permit on Permits & Licenses')}
          columns={[
            {
              key: 'requirementId', label: 'Reference', width: 180,
              render: (r) => <TwoLine top={<Ref>{r.requirementId}</Ref>} bottom={r.category} />,
            },
            {
              key: 'name', label: 'Obligation',
              render: (r) => <TwoLine top={r.name} bottom={r._permitNumber ? `Permit ${r._permitNumber}` : ''} />,
            },
            { key: 'siteId', label: 'Site', width: 78, render: (r) => <SiteChip code={r._siteCode} /> },
            {
              key: '_kind', label: 'Kind', width: 140,
              render: (r) => <StatusBadge tone={KIND_TONE[r._kind]}>{KIND_LABEL[r._kind]}</StatusBadge>,
            },
            { key: 'frequency', label: 'Frequency', width: 120 },
            {
              key: '_lastFiled', label: 'Last filed', width: 150,
              // The one column that turns a register of duties into a record of
              // compliance. A standing obligation is never filed against, so it
              // says so rather than reading as an omission.
              sortValue: (r) => r._lastFiled?.filedDate || '',
              render: (r) => {
                // "Not filed against" only where nothing has been. A standing
                // duty is normally never filed against and saying so beats an
                // empty cell — but a filing that does exist has to show, or the
                // column hides a record rather than explaining one.
                if (!r._lastFiled) {
                  return (r._kind === KIND.CONTINUOUS || r._kind === KIND.EVENT)
                    ? <span style={{ fontSize: 11, color: '#cbd5e1' }}>Not filed against</span>
                    : <Blank label="No evidence yet" />
                }
                return (
                  <div>
                    <DateVal value={r._lastFiled.filedDate} />
                    <div style={{ fontSize: 10.5, color: r._late ? '#b45309' : '#64748b', marginTop: 2, fontWeight: 600 }}>
                      {r._filings.length} filed{r._late ? ` · ${r._late} late` : ''}
                    </div>
                  </div>
                )
              },
            },
            {
              key: 'deadlineRule', label: 'Deadline rule', width: 220,
              render: (r) => (r.deadlineRule
                ? <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>{r.deadlineRule}</span>
                : <Blank />),
            },
            {
              key: 'submissionMethod', label: 'Submitted to', width: 190,
              render: (r) => (r.submissionMethod
                ? <span style={{ fontSize: 12, color: '#475569' }}>{r.submissionMethod}</span>
                : <Blank />),
            },
            {
              key: 'retentionRule', label: 'Retention', width: 120,
              render: (r) => (r.retentionRule
                ? <span style={{ fontSize: 12, color: '#475569' }}>{r.retentionRule}</span>
                : <Blank label="Not specified" />),
            },
            {
              // Every obligation can be answered from here, including the
              // seventeen that never reach a calendar — which is the whole point
              // of the column. `stopPropagation` because the row itself opens
              // the record.
              key: 'act', label: '', width: 190, sortable: false,
              render: (r) => (
                <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <ActionButton size="sm" variant="subtle" onClick={() => setFiling(subjectFor(r))}>
                    Record filing
                  </ActionButton>
                  {r._lastFiled && (attachedTo.get(r._lastFiled.recordId)?.length || 0) > 0 && (
                    <ActionButton size="sm" variant="ghost" onClick={() => setViewing(r._lastFiled)}>
                      {attachedTo.get(r._lastFiled.recordId).length} file
                      {attachedTo.get(r._lastFiled.recordId).length === 1 ? '' : 's'}
                    </ActionButton>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Section>

      {/* Filings against the register and obligations added in the portal, with
          their evidence and remarks, on the register they were made from. */}
      <ModuleActivity
        module="requirements"
        filings={filings}
        empty="Nothing has been filed or added yet. Filings and new obligations appear here."
      />

      <PickObligationModal
        open={picking}
        obligations={all}
        subjectFor={subjectFor}
        onClose={() => setPicking(false)}
        onPick={(r) => {
          setPicking(false)
          // Exactly what the row's button hands over, so a filing started from
          // the header is the same record, with the same due date or none.
          setFiling(subjectFor(r))
        }}
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
              detail: payload.dueDate
                ? `Due ${fmtDate(payload.dueDate)} · from the register`
                : 'Recorded against the obligation · from the register',
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

/**
 * Choose which obligation a filing answers.
 *
 * Searchable by reference, name, category, permit or site, because a person
 * holding a report knows it by one of those and rarely by its row position. The
 * list is the register as the scope filter shows it — workbook obligations and
 * any added in the portal — and the choice is described before continuing, so a
 * standing duty is not mistaken for the dated report beside it.
 */
function PickObligationModal({ open, obligations, subjectFor, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState('')

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) { setQ(''); setChosen('') }
  }
  if (!open) return null

  const needle = q.trim().toLowerCase()
  const matches = obligations.filter((r) => !needle || [
    r.requirementId, r.name, r.category, r._permitNumber, r._siteCode,
  ].filter(Boolean).join(' ').toLowerCase().includes(needle))
  // Only a choice still in the list counts. Searching a chosen obligation out
  // of view and pressing Continue must not file against a row nobody can see.
  const picked = matches.find((r) => r.requirementId === chosen) || null
  // What the filing form will open as — the row button's own subject — so the
  // person knows before continuing whether it is dated, and against which date.
  const subject = picked ? subjectFor(picked) : null
  const filedAs = !subject ? ''
    : subject.occurrenceId && subject.dueDate
      ? `The next outstanding occurrence — due ${fmtDate(subject.dueDate)}`
      : 'Against the obligation itself — it has no due date to file for'

  return (
    <Modal
      open
      onClose={onClose}
      title="Record filing"
      subtitle="Choose the obligation this filing answers"
      width={620}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!picked} onClick={() => onPick(picked)}>
            Continue
          </ActionButton>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={field}>
          <span style={label}>Search</span>
          <input
            value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            placeholder="Reference, obligation, permit or site — e.g. AIR-002 or visible emissions"
            style={input}
          />
        </label>

        <label style={field}>
          <span style={label}>
            Obligation <span style={{ color: '#dc2626' }}>*</span>
            <span style={{ fontWeight: 500, color: '#94a3b8' }}> · {matches.length} of {obligations.length}</span>
          </span>
          <select
            size={8} value={picked ? chosen : ''} onChange={(e) => setChosen(e.target.value)}
            onDoubleClick={() => { if (picked) onPick(picked) }}
            style={{ ...input, height: 'auto', padding: 4, cursor: 'pointer' }}
          >
            {matches.map((r) => (
              <option key={r.requirementId} value={r.requirementId} style={{ padding: '6px 8px' }}>
                {r.requirementId} — {r.name}
              </option>
            ))}
          </select>
          {matches.length === 0 && (
            <span style={{ display: 'block', marginTop: 6, fontSize: 11.5, color: '#94a3b8' }}>
              No obligation matches that search.
            </span>
          )}
        </label>

        {picked && (
          <div style={box}>
            <Row k="Reference" v={picked.requirementId} />
            <Row k="Obligation" v={picked.name} />
            <Row k="Permit · site" v={[picked._permitNumber, picked._siteCode].filter(Boolean).join(' · ') || '—'} />
            <Row k="Kind" v={KIND_LABEL[picked._kind] || '—'} />
            <Row k="Frequency" v={picked.frequency || '—'} />
            <Row
              k="Last filed"
              v={picked._lastFiled ? `${fmtDate(picked._lastFiled.filedDate)} · ${picked._filings.length} filed` : 'Not filed yet'}
            />
            <Row k="Will be filed" v={filedAs} last />
          </div>
        )}
      </div>
    </Modal>
  )
}

function Row({ k, v, last }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: last ? 'none' : '1px solid #eef2f7' }}>
      <span style={{ fontSize: 11.5, color: '#94a3b8', flex: '0 0 110px' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: '#0f172a', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}

const field = { display: 'block', minWidth: 0 }
const label = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }
const box = { padding: '10px 13px', borderRadius: 10, background: '#f8fafc', border: '1px solid #eef2f7' }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
