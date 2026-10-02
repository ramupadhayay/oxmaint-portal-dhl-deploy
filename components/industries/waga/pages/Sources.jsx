'use client'

// Source and verification — where every figure in this portal came from.
//
// This screen has no equivalent in the supplied mockup and it earns its place.
// The workbook shipped with a fourteen-row Verification_Log recording what was
// checked against which permit PDF or tracker tab, what the first draft got
// wrong, and how confident the checker was. That is unusual and valuable: it is
// the difference between a demo whose numbers are asserted and one whose
// numbers can be chased.
//
// It also protects the reader from the portal. Four permits have no expiry, one
// screen is deliberately empty, and every calendar date is computed rather than
// recorded. Anyone reasonably asks why, and this is the page that answers
// without them having to open a spreadsheet.
//
// It is also where the portal keeps its own audit trail. The Verification_Log
// says where the *data* came from; the activity log below says what the
// compliance team *did* with it — every filing marked, deviation worked and
// reading logged, appended and never edited. Two kinds of traceability, and the
// one screen a regulator would ask for both on.

import { useMemo, useState } from 'react'
import { Section, DataTable, Toolbar, StatusBadge } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, TwoLine, Note, SiteChip, Blank } from '../components/cells'
import { useCreated } from '../lib/store'
import { README, VERIFICATION, PERMITS, ORG, WORKBOOK_TASKS, fmtDate } from '../lib/data'

const CONF_TONE = { High: 'green', Medium: 'amber', Low: 'red' }

// Colour by what the action means: a closed deviation and a filing are good, a
// raised deviation or a breach wants the eye. Read off the verb so a new action
// type lands somewhere sensible without a lookup entry.
const ACTION_TONE = (action = '') => (
  /raised|breach/i.test(action) ? 'amber'
    : /closed|filed/i.test(action) ? 'green'
      : 'blue'
)

// Instant, not date — the audit trail's whole value is the order things
// happened in, and two filings on the same day need their times to sit right.
const fmtAt = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function Sources() {
  const [search, setSearch] = useState('')
  const [confidence, setConfidence] = useState('all')
  const [activitySearch, setActivitySearch] = useState('')

  const audit = useCreated('waga_audit')
  const activity = useMemo(() => {
    const q = activitySearch.trim().toLowerCase()
    if (!q) return audit
    return audit.filter((a) => [a.action, a.subject, a.detail, a.actor].filter(Boolean).join(' ').toLowerCase().includes(q))
  }, [audit, activitySearch])

  const confidences = [...new Set(VERIFICATION.map((v) => v.confidence))].filter(Boolean)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return VERIFICATION.filter((v) => (
      (confidence === 'all' || v.confidence === confidence) &&
      (!q || [v.area, v.verification, v.verifiedSource, v.actionTaken, v.productionNote].join(' ').toLowerCase().includes(q))
    ))
  }, [search, confidence])

  const changed = VERIFICATION.filter((v) => v.actionTaken && !/no change/i.test(v.actionTaken)).length
  const sourceFiles = [...new Set(PERMITS.map((p) => p.sourceFile).filter(Boolean))]

  return (
    <div>
      <PageHeading
        title="Source & Verification"
        subtitle={`How every figure in this portal was checked, against which document, and with what confidence — ${ORG.name} trial data.`}
      />

      <StatCards items={[
        { label: 'Verification checks', value: VERIFICATION.length, icon: 'tick' },
        { label: 'High confidence', value: VERIFICATION.filter((v) => v.confidence === 'High').length, tone: 'green' },
        { label: 'Corrected in review', value: changed, tone: 'amber', note: 'Added or fixed after v1' },
        { label: 'Source documents', value: sourceFiles.length, note: 'Permit PDFs and trackers', icon: 'list' },
        { label: 'Activity logged', value: audit.length, note: 'Actions taken in the portal', tone: audit.length ? 'green' : undefined, icon: 'clock' },
      ]} />

      <Note>
        This portal reproduces its source. Where the source is silent the screens say so rather
        than filling the gap, and every date on the calendar is arithmetic over a stated rule
        rather than a record anyone entered.
      </Note>

      <Section title="Activity in this portal" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Append-only audit trail</span>}>
        <Note tone="grey">
          Every filing marked, deviation raised or worked, and reading logged is recorded here
          with who did it and when. Nothing on this trail is edited or removed — it is the record
          of what was done, kept separate from the verification of where the data came from.
        </Note>

        {audit.length === 0 ? (
          <div style={{ padding: '30px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
            Nothing recorded yet. Filings, deviations and readings appear here as the compliance team works.
          </div>
        ) : (
          <>
            <Toolbar
              search={activitySearch} onSearch={setActivitySearch}
              placeholder="Search action, subject or who…"
            />
            <DataTable
              rows={activity}
              pageSize={12}
              empty="No activity matches this search."
              columns={[
                { key: 'at', label: 'When', width: 170, render: (a) => <span style={{ fontSize: 11.5, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{fmtAt(a.at)}</span> },
                { key: 'action', label: 'Action', width: 210, render: (a) => <StatusBadge tone={ACTION_TONE(a.action)}>{a.action}</StatusBadge> },
                { key: 'subject', label: 'Subject', render: (a) => <TwoLine top={a.subject} bottom={a.detail || ''} /> },
                { key: 'actor', label: 'By', width: 140, render: (a) => <span style={{ fontSize: 12, color: '#334155' }}>{a.actor}</span> },
              ]}
            />
          </>
        )}
      </Section>

      <Section title="Rules this import follows" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Workbook README, verbatim</span>}>
        <div style={{ display: 'grid', gap: 9 }}>
          {README.map((r) => (
            <div key={r.topic} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,170px) 1fr', gap: 14, padding: '10px 12px', background: '#f8fafc', border: '1px solid #eef1f6', borderRadius: 9 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#15227a' }}>{r.topic}</div>
              <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55 }}>{r.text}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Workbook task rows carried unmodified" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Compliance_Tasks sheet, as supplied</span>}>
        <Note tone="warn">
          The seven rows on the workbook&apos;s Compliance_Tasks sheet, reproduced as supplied.
          Five are labelled demo-generated and two are real source deadlines — the label on each
          row is the workbook&apos;s own. None is a WAGA completion record, which is why the
          compliance calendar projects its dates from the rules instead of reading these rows.
          They live here, with the verification, rather than on the calendar the compliance team
          works.
        </Note>

        <DataTable
          rows={WORKBOOK_TASKS}
          pageSize={10}
          empty="No workbook task rows in the import."
          columns={[
            { key: 'taskId', label: 'Reference', width: 170, render: (t) => <Ref>{t.taskId}</Ref> },
            { key: 'title', label: 'Task', render: (t) => <TwoLine top={t.title} bottom={t.requirementId} /> },
            { key: 'siteId', label: 'Site', width: 78, render: (t) => <SiteChip code={t.siteId.replace('SITE-', '')} /> },
            { key: 'dueDate', label: 'Due', width: 120, render: (t) => (t.dueDate ? fmtDate(t.dueDate) : <Blank />) },
            { key: 'status', label: 'Status', width: 110, render: (t) => <StatusBadge>{t.status}</StatusBadge> },
            {
              key: 'provenance', label: 'Workbook label', width: 250,
              render: (t) => (
                <span style={{ fontSize: 11.5, color: /demo/i.test(t.provenance) ? '#b45309' : '#047857', fontWeight: 600 }}>
                  {t.provenance || '—'}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Verification log">
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search area, source or finding…"
          filters={[{ label: 'Confidence', value: confidence, onChange: setConfidence, options: confidences }]}
        />

        <DataTable
          rows={rows}
          pageSize={15}
          empty="No checks match these filters."
          columns={[
            { key: 'checkId', label: 'Check', width: 90, render: (v) => <Ref>{v.checkId}</Ref> },
            { key: 'area', label: 'Area', width: 200, render: (v) => <TwoLine top={v.area} bottom={v.v1Result} /> },
            {
              key: 'verification', label: 'What was verified',
              render: (v) => <span style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>{v.verification}</span>,
            },
            {
              key: 'verifiedSource', label: 'Against', width: 200,
              render: (v) => <span style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.45 }}>{v.verifiedSource}</span>,
            },
            {
              key: 'actionTaken', label: 'Action', width: 180,
              render: (v) => (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: /no change/i.test(v.actionTaken) ? '#94a3b8' : '#b45309' }}>
                  {v.actionTaken}
                </span>
              ),
            },
            {
              key: 'confidence', label: 'Confidence', width: 110,
              render: (v) => <StatusBadge tone={CONF_TONE[v.confidence] || 'grey'}>{v.confidence}</StatusBadge>,
            },
          ]}
        />
      </Section>

      <Section title="Source documents behind the permit register">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 10 }}>
          {PERMITS.filter((p) => p.sourceFile).map((p) => (
            <div key={p.permitId} style={{ padding: '12px 14px', border: '1px solid #e4e9f0', borderRadius: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <Ref>{p.permitNumber}</Ref>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{p.agency}</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#475569', marginTop: 6, lineHeight: 1.5, wordBreak: 'break-word' }}>{p.sourceFile}</div>
              {p.notes ? <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, lineHeight: 1.5 }}>{p.notes}</div> : null}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
