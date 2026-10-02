'use client'

// One permit, or one requirement, opened in full.
//
// Both are reference records rather than transactions — nobody edits a permit
// in this portal, they read it and follow it back to the PDF it came from — so
// the page is a detail sheet with its source at the bottom and the things that
// hang off it underneath.
//
// A reference that does not resolve gets a real message rather than an empty
// shell. A compliance portal is exactly where someone pastes a permit number
// from an email, and "no permit with that reference" is the answer to that,
// where a blank page reads as a broken deploy.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Section, DataTable, StatusBadge, ActionButton, Modal } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { Ref, SiteChip, DateVal, Blank, Note, Source, TwoLine, Derived } from '../components/cells'
import FilingModal from '../components/FilingModal'
import EvidenceViewer from '../components/EvidenceViewer'
import {
  permits, requirements, parameters, deviations, permitHealth, fmtDate, siteOf, siteCode,
} from '../lib/data'
import { useCreated, useStore } from '../lib/store'
import { recordFiling, attachmentsByFiling } from '../lib/filing'
import { generateOccurrences, kindOf, KIND, KIND_LABEL } from '../lib/schedule'

const KIND_TONE = { recurring: 'blue', milestone: 'violet', continuous: 'green', event: 'amber' }

export default function RecordView({ section, id }) {
  const router = useRouter()
  const back = () => router.push(`/portal/waga/${section}`)

  if (section === 'permits') return <PermitView id={id} back={back} router={router} />
  if (section === 'requirements') return <RequirementView id={id} back={back} router={router} />
  return <NotFound what="record" id={id} back={back} />
}

// ── permit ───────────────────────────────────────────────────────────────
function PermitView({ id, back, router }) {
  // Permits added in the portal live in the record store, not the seeded set,
  // so a click into one has to resolve there too — otherwise a permit visible
  // on the register opens as "not found", which reads as a broken deploy.
  const created = useCreated('waga_permit_event')
  const createdRequirements = useCreated('waga_requirement')
  const audit = useCreated('waga_audit')
  const filings = useCreated('waga_filing')
  const store = useStore()
  const [addingRequirement, setAddingRequirement] = useState(false)
  const raised = created.find((x) => x._raised && (x.permitId === id || x.permitNumber === id))
  const seeded = permits.find((x) => x.permitId === id || x.permitNumber === id)
  // A seeded permit worked in the portal carries an overlay row keyed by its
  // permitId — the renewal status, the renewed expiry, a changed number. The
  // register merges it; this page used to read the seeded row alone, so a permit
  // showing "Renewal Submitted" on the list opened here still saying Active with
  // the old expiry. Same merge the register does: the stored row wins.
  const overlay = seeded ? created.find((x) => x.recordId === seeded.permitId) : null
  const p = seeded
    ? { ...seeded, ...(overlay || {}) }
    : (raised ? {
      ...raised,
      _site: siteOf(raised.siteId),
      _siteCode: siteCode(raised.siteId),
      _requirementCount: 0,
    } : null)
  if (!p) return <NotFound what="permit" id={id} back={back} />

  const h = permitHealth(p)
  const reqs = [
    ...requirements,
    ...createdRequirements.filter((r) => !requirements.some((x) => x.requirementId === r.requirementId)),
  ].filter((r) => r.permitId === p.permitId).map((r) => ({
    ...r,
    _site: r._site || p._site,
    _siteCode: r._siteCode || p._siteCode,
    _permit: r._permit || p,
    _permitNumber: r._permitNumber || p.permitNumber,
  }))
  const params = parameters.filter((x) => x.permitId === p.permitId)
  // Deviations against this permit as they stand: the workbook's, with any
  // change made in the portal laid over them, and any raised in the portal.
  // This used to read the workbook alone, so a deviation reported against
  // 42-00254A was on the Deviations screen and missing from 42-00254A's own page.
  // Read from the store rather than a hook, which could not sit below the
  // not-found return above.
  const storedDevs = store?.records?.waga_deviation || []
  const devs = [
    ...storedDevs.filter((d) => d.permitId === p.permitId
      && !deviations.some((x) => x.deviationId === d.recordId || x.deviationId === d.deviationId)),
    ...deviations.filter((d) => d.permitId === p.permitId).map((d) => {
      const patch = storedDevs.find((x) => x.recordId === d.deviationId)
      return patch ? { ...d, ...patch } : d
    }),
  ]

  // What has been done to this permit in the portal, newest first — the audit
  // trail from Source & Verification, narrowed to this permit, so the history
  // sits on the page where the renewal was worked rather than two screens away.
  //
  // Audit rows carry no permit id, only the sentence they were logged with, so
  // they are matched on the number: a renewal or a new permit logs
  // "<number> · <type>", an obligation logs "Under permit <number>". A renewal
  // that changed the number logs the new one, so the old number is matched too.
  // Filings are matched through their obligation's id instead, which is exact —
  // their audit sentence names the obligation, not the permit.
  const numbers = [...new Set([p.permitNumber, p.renewedFromNumber, seeded?.permitNumber].filter(Boolean))]
  const reqIds = new Set(reqs.map((r) => r.requirementId))
  // Deviations are matched by their own ids: every line the portal logs about
  // one — raised, raised automatically from a reading, moved along CAPA — names
  // the deviation, not the permit it sits under.
  const devIds = devs.map((d) => d.deviationId).filter(Boolean)
  // Readings carry the permit they were taken against, and their own remark, so
  // they are read from their records rather than from the audit line, which
  // names the parameter and drops the note.
  const readings = (store?.records?.waga_reading || []).filter((r) => r.permitId === p.permitId)
  const newestFirst = (a, b) => String(b.at || '').localeCompare(String(a.at || ''))

  const auditRows = audit
    .filter((a) => {
      const s = String(a.subject || '')
      return numbers.some((n) => s.startsWith(`${n} ·`) || String(a.detail || '') === `Under permit ${n}`)
        || devIds.some((id) => s.startsWith(`${id} ·`))
    })
    .map((a) => ({ at: a.at || a._createdAt, action: a.action, subject: a.subject, detail: a.detail, actor: a.actor }))

  // The remark on the renewal in progress. Until now a renewal's note was saved
  // on the permit but never written into its audit line, so the history showed
  // the step and not what the person said about it. The note the permit holds is
  // put back on the entry it belongs to: the latest step of the stage the permit
  // is in. Notes from earlier cycles were overwritten on the permit and are gone;
  // steps logged from now on carry their own.
  const stageAction = p.renewalStage === 'Received' ? 'Renewal received'
    : p.renewalStage === 'Submitted' ? 'Renewal submitted' : null
  const current = stageAction ? auditRows.filter((a) => a.action === stageAction).sort(newestFirst)[0] : null
  if (current && p.renewalNote && !/Note:/.test(current.detail || '')) {
    current.detail = [current.detail, `Note: ${p.renewalNote}`].filter(Boolean).join(' · ')
  }

  const activity = [
    ...auditRows,
    ...filings
      .filter((f) => reqIds.has(f.requirementId))
      .map((f) => ({
        at: f._createdAt,
        action: 'Filed obligation',
        subject: f.title,
        detail: [
          f.filedDate && `Filed ${fmtDate(f.filedDate)}`,
          f.evidenceRef && `evidence: ${f.evidenceRef}`,
          f.attachmentCount ? `${f.attachmentCount} file${f.attachmentCount === 1 ? '' : 's'}` : '',
          f.note && `Note: ${f.note}`,
        ].filter(Boolean).join(' · '),
        actor: f.filedBy,
      })),
    ...readings.map((r) => ({
      at: r._createdAt,
      action: r.judgment === 'Breach' ? 'Reading — breach' : 'Reading logged',
      subject: `${r.parameter} · ${r.scope}`,
      detail: [
        `${r.value}${r.unit ? ` ${r.unit}` : ''}${r.limitValue != null ? ` against ${r.limitValue}` : ''} — ${r.judgment}`,
        r.readingDate && `read ${fmtDate(r.readingDate)}`,
        r.note && `Note: ${r.note}`,
      ].filter(Boolean).join(' · '),
      actor: r.readBy || 'QHSE / Site Ops',
    })),
  ].sort(newestFirst)
  // The instant, not the date: two steps on one afternoon need their order.
  const fmtAt = (iso) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    })
  }

  return (
    <div>
      <PageHeading
        back={{ label: 'Permits & Licenses', onClick: back }}
        title={p.permitType}
        subtitle={p.permitTitle || `${p.agency} · ${p._site?.siteName || ''}`}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <ActionButton size="sm" onClick={() => setAddingRequirement(true)}>Add obligation</ActionButton>
            <StatusBadge tone={h.tone}>{p.status}</StatusBadge>
          </div>
        )}
      />

      <Section title="Permit detail">
        <Grid rows={[
          ['Permit number', <Ref key="n">{p.permitNumber}</Ref>],
          ['Reference', <Ref key="r">{p.permitId}</Ref>],
          ['Agency', p.agency || <Blank />],
          ['Programme', p.program || <Blank />],
          ['Site', <span key="s" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><SiteChip code={p._siteCode} />{p._site?.siteName}</span>],
          ['Legal entity', p._site?.legalEntity || <Blank />],
          ['Issued', <DateVal key="i" value={p.issueDate} blank="Not in tracker" />],
          ['Expires', <DateVal key="e" value={p.expirationDate} blank="Not stated in source" />],
          ['Renewal application due', <DateVal key="rd" value={p.renewalDeadline} blank="No renewal date stated" />],
          ['Status', p.status],
        ]} />
        {p.notes ? <Note tone="grey">{p.notes}</Note> : null}
        {p.sourceFile ? (
          <div style={{
            marginTop: 10, padding: '9px 11px', background: '#f8fafc',
            border: '1px solid #eef1f6', borderRadius: 8, fontSize: 11.5, color: '#64748b', lineHeight: 1.55,
          }}>
            <span style={{ fontWeight: 700, color: '#475569' }}>Read from source document: </span>
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#334155' }}>{p.sourceFile}</span>
            <div style={{ marginTop: 3, color: '#94a3b8' }}>
              The permit document this data was verified against, held in WAGA&apos;s records — a filename
              for traceability, not a file stored in the portal.
            </div>
          </div>
        ) : null}
      </Section>

      <Section
        title={`Activity on this permit (${activity.length})`}
        right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>From the audit trail</span>}
      >
        <DataTable
          rows={activity}
          pageSize={8}
          empty="Nothing has been done to this permit in the portal yet. Renewals, obligations added and filings appear here."
          columns={[
            {
              key: 'at', label: 'When', width: 170,
              render: (a) => <span style={{ fontSize: 11.5, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{fmtAt(a.at)}</span>,
            },
            {
              key: 'action', label: 'Action', width: 190,
              render: (a) => <StatusBadge tone={/received|filed|added/i.test(a.action) ? 'green' : 'blue'}>{a.action}</StatusBadge>,
            },
            { key: 'subject', label: 'Detail', render: (a) => <TwoLine top={a.subject} bottom={a.detail || ''} /> },
            { key: 'actor', label: 'By', width: 140, render: (a) => <span style={{ fontSize: 12, color: '#334155' }}>{a.actor}</span> },
          ]}
        />
      </Section>

      <Section title={`Obligations under this permit (${reqs.length})`}>
        <DataTable
          rows={reqs}
          pageSize={12}
          onRowClick={(r) => router.push(`/portal/waga/requirements/${r.requirementId}`)}
          empty="No requirements are recorded against this permit."
          columns={[
            { key: 'requirementId', label: 'Reference', width: 180, render: (r) => <Ref>{r.requirementId}</Ref> },
            { key: 'name', label: 'Obligation', render: (r) => <TwoLine top={r.name} bottom={r.category} /> },
            { key: 'frequency', label: 'Frequency', width: 130 },
            {
              key: 'deadlineRule', label: 'Deadline', width: 220,
              render: (r) => (r.deadlineRule ? <span style={{ fontSize: 12, color: '#475569' }}>{r.deadlineRule}</span> : <Blank />),
            },
            {
              key: 'kind', label: 'Kind', width: 140, sortable: false,
              render: (r) => <StatusBadge tone={KIND_TONE[kindOf(r)]}>{KIND_LABEL[kindOf(r)]}</StatusBadge>,
            },
          ]}
        />
      </Section>

      <AddObligationModal
        permit={p}
        open={addingRequirement}
        onClose={() => setAddingRequirement(false)}
        onSave={async (payload) => {
          const saved = await store.create('waga_requirement', payload)
          if (saved) {
            await store.log('Obligation added', `${payload.requirementId} · ${payload.name}`, `Under permit ${p.permitNumber}`, payload.siteId)
            store.notify(`Obligation added under ${p.permitNumber}.`)
            setAddingRequirement(false)
          }
        }}
      />

      {params.length > 0 && (
        <Section title={`Limits set by this permit (${params.length})`}>
          <DataTable
            rows={params}
            pageSize={10}
            empty=""
            columns={[
              { key: 'parameterId', label: 'Reference', width: 150, render: (x) => <Ref>{x.parameterId}</Ref> },
              { key: 'scope', label: 'Equipment', width: 220, render: (x) => <TwoLine top={x.scope} bottom={x.parameter} /> },
              { key: 'limitText', label: 'Limit', render: (x) => <span style={{ fontWeight: 600 }}>{x.limitText}</span> },
              { key: 'dataMode', label: 'Monitored by', width: 170 },
            ]}
          />
        </Section>
      )}

      {devs.length > 0 && (
        <Section title={`Deviations against this permit (${devs.length})`}>
          {devs.map((d) => (
            <div key={d.deviationId} style={{ padding: '12px 14px', border: '1px solid #e4e9f0', borderLeft: '3px solid #b45309', borderRadius: 10, marginBottom: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <Ref>{d.deviationId}</Ref>
                <StatusBadge tone={d.status === 'Closed' ? 'green' : 'amber'}>{d.status}</StatusBadge>
              </div>
              <div style={{ fontSize: 12.5, color: '#0f172a', marginTop: 6, lineHeight: 1.5 }}>{d.description}</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 5 }}>Event {fmtDate(d.eventDate)}</div>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function AddObligationModal({ permit, open, onClose, onSave }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [frequency, setFrequency] = useState('Monthly')
  const [deadlineRule, setDeadlineRule] = useState('')
  const [responsibleParty, setResponsibleParty] = useState('')
  const [submissionMethod, setSubmissionMethod] = useState('')
  const [retentionRule, setRetentionRule] = useState('')
  const [regulatorySource, setRegulatorySource] = useState('')
  const [seen, setSeen] = useState(false)

  if (open !== seen) {
    setSeen(open)
    if (open) {
      setName(''); setCategory(''); setFrequency('Monthly'); setDeadlineRule('')
      setResponsibleParty(''); setSubmissionMethod(''); setRetentionRule(''); setRegulatorySource('')
    }
  }
  if (!permit) return null
  const valid = name.trim() && category.trim() && frequency.trim()
  const id = `REQ-${permit._siteCode || 'SITE'}-PORTAL-${Date.now().toString(36).toUpperCase()}`

  return (
    <Modal open={open} onClose={onClose} title="Add compliance obligation"
      subtitle={`Create a task or obligation under ${permit.permitNumber}. It will appear in the register and calendar when schedulable.`} width={680}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid} onClick={() => onSave({
            requirementId: id, permitId: permit.permitId, siteId: permit.siteId,
            name: name.trim(), category: category.trim(), frequency: frequency.trim(),
            deadlineRule: deadlineRule.trim(), responsibleParty: responsibleParty.trim(),
            submissionMethod: submissionMethod.trim(), retentionRule: retentionRule.trim(),
            regulatorySource: regulatorySource.trim(), _raised: true, source: 'WAGA portal',
            // Persist the permit number and site code this obligation is created
            // under. The Requirements register, Calendar and Overview read created
            // rows straight from the store without the permit lookup PermitView
            // does, so without these it shows there with a blank permit reference
            // and no site chip.
            _permitNumber: permit.permitNumber, _siteCode: permit._siteCode,
          })}>Add obligation</ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={box}>
          <Row k="Permit" v={`${permit.permitNumber} — ${permit.permitType}`} />
          <Row k="Site" v={`${permit._siteCode || '—'} · ${permit._site?.siteName || '—'}`} last />
        </div>
        <Field label="Obligation / compliance task" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Submit quarterly emissions report" style={input} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Category" required><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Air emissions" style={input} /></Field>
          <Field label="Frequency" required>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={input}>
              {['Weekly', 'Monthly', 'Quarterly', 'Semiannual', 'Annual', 'Every 5 years', 'Continuous', 'Event-driven'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Deadline rule" hint="Use a month/day or plain rule such as ‘End of quarter’. The calendar only projects dates it can resolve safely.">
          <input value={deadlineRule} onChange={(e) => setDeadlineRule(e.target.value)} placeholder="e.g. March 31 / June 30 / September 30 / December 31" style={input} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Responsible party"><input value={responsibleParty} onChange={(e) => setResponsibleParty(e.target.value)} placeholder="e.g. Environmental Manager" style={input} /></Field>
          <Field label="Submitted to"><input value={submissionMethod} onChange={(e) => setSubmissionMethod(e.target.value)} placeholder="e.g. State regulator portal" style={input} /></Field>
          <Field label="Retention rule"><input value={retentionRule} onChange={(e) => setRetentionRule(e.target.value)} placeholder="e.g. Retain 5 years" style={input} /></Field>
          <Field label="Regulatory source / clause"><input value={regulatorySource} onChange={(e) => setRegulatorySource(e.target.value)} placeholder="e.g. Permit condition 3.2" style={input} /></Field>
        </div>
      </div>
    </Modal>
  )
}

// ── requirement ──────────────────────────────────────────────────────────
function RequirementView({ id, back, router }) {
  // Every filing recorded against this obligation. The calendar writes the
  // requirement id onto each one, so the join already exists — it had simply
  // never been read from this side, which meant an obligation filed four times
  // looked exactly like one nobody had touched.
  const filings = useCreated('waga_filing')
  const attachmentRows = useCreated('waga_attachment')
  const attachedTo = useMemo(() => attachmentsByFiling(attachmentRows), [attachmentRows])
  const store = useStore()
  const createdRequirements = useCreated('waga_requirement')
  const createdPermits = useCreated('waga_permit_event')
  const [filing, setFiling] = useState(null)
  const [viewing, setViewing] = useState(null)

  const base = requirements.find((x) => x.requirementId === id)
    || createdRequirements.find((x) => x.requirementId === id)
  const linkedPermit = base && (permits.find((p) => p.permitId === base.permitId)
    || createdPermits.find((p) => p.permitId === base.permitId))
  const r = base && {
    ...base,
    _permit: base._permit || linkedPermit || null,
    _permitNumber: base._permitNumber || linkedPermit?.permitNumber || '',
    _site: base._site || linkedPermit?._site || null,
    _siteCode: base._siteCode || linkedPermit?._siteCode || siteCode(base.siteId),
  }
  // Hooks above the early return: this component is a branch of RecordView and
  // React counts hooks per render, so a `return` between them would change the
  // count when a reference does not resolve.
  if (!r) return <NotFound what="requirement" id={id} back={back} />

  const kind = kindOf(r)
  const dated = kind === KIND.RECURRING || kind === KIND.MILESTONE

  const mine = filings
    .filter((f) => f.requirementId === id)
    .map((f) => ({
      ...f,
      // On time or late, against the date it was due. This is the question an
      // auditor asks about a filing and it is arithmetic, so it is computed
      // rather than left for a reader to work out from two dates in a row.
      _late: f.dueDate && f.filedDate ? f.filedDate > f.dueDate : null,
      _days: f.dueDate && f.filedDate
        ? Math.round((new Date(f.filedDate) - new Date(f.dueDate)) / 86400000)
        : null,
    }))
    .sort((a, b) => String(b.filedDate || '').localeCompare(String(a.filedDate || '')))

  const filedByOccurrence = new Map(mine.map((f) => [f.occurrenceId, f]))
  const lastFiled = mine[0] || null
  const lateCount = mine.filter((f) => f._late).length

  const occ = dated
    ? generateOccurrences([r], permits).slice(0, 12).map((o) => ({ ...o, _filing: filedByOccurrence.get(o.occurrenceId) || null }))
    : []

  // What the heading's button files against: the first projected occurrence
  // nobody has answered, or — when the rule projects nothing — the obligation
  // itself. Seventeen of the thirty-four obligations fall in the second case,
  // and before this they had no way to record compliance at all.
  const nextSubject = occ.find((o) => !o._filing) || { ...r, _siteCode: r._siteCode }

  const fileIt = async ({ payload, files }) => {
    const done = await recordFiling(store, {
      payload,
      files,
      audit: {
        action: 'Filed obligation',
        subject: `${payload.title} (${payload.siteCode})`,
        detail: payload.dueDate
          ? `Due ${fmtDate(payload.dueDate)} · from the obligation record`
          : 'Recorded against the obligation · no projected date',
      },
    })
    if (done) {
      store.notify(`Filed — ${payload.title}.`)
      setFiling(null)
    }
  }

  return (
    <div>
      <PageHeading
        back={{ label: 'Requirements Register', onClick: back }}
        title={r.name}
        subtitle={`${r.category} obligation${r._permitNumber ? ` under permit ${r._permitNumber}` : ''}`}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {lastFiled && <StatusBadge tone="green">Last filed {fmtDate(lastFiled.filedDate)}</StatusBadge>}
            <StatusBadge tone={KIND_TONE[kind]}>{KIND_LABEL[kind]}</StatusBadge>
            {/* The obligation can be answered from its own record, whether or
                not the portal can project a date for it. */}
            <ActionButton size="sm" onClick={() => setFiling(nextSubject)}>Record filing</ActionButton>
          </div>
        )}
      />

      <Section title="Obligation detail">
        <Grid rows={[
          ['Reference', <Ref key="r">{r.requirementId}</Ref>],
          ['Category', r.category || <Blank />],
          ['Site', <span key="s" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><SiteChip code={r._siteCode} />{r._site?.siteName}</span>],
          ['Permit', r._permit
            ? <button key="p" onClick={() => router.push(`/portal/waga/permits/${r._permit.permitId}`)} style={linkBtn}>{r._permit.permitNumber} — {r._permit.permitType} →</button>
            : <Blank />],
          ['Frequency', r.frequency || <Blank />],
          ['Deadline rule', r.deadlineRule || <Blank />],
          ['Responsible party', r.responsibleParty || <Blank label="Not assigned in source" />],
          ['Submitted to', r.submissionMethod || <Blank />],
          ['Retention', r.retentionRule || <Blank label="Not specified in source" />],
        ]} />
        {r.regulatorySource ? <Source>{r.regulatorySource}</Source> : null}
      </Section>

      <Section
        title={`Compliance history (${mine.length})`}
        right={mine.length > 0 && (
          <span style={{ fontSize: 11.5, color: lateCount ? '#b45309' : '#047857', fontWeight: 700 }}>
            {lateCount ? `${lateCount} filed late` : 'All filed on time'}
          </span>
        )}
      >
        {mine.length === 0 ? (
          <Note tone="grey">
            Nothing has been filed against this obligation in the portal. The source workbook
            carries no completion history either, so there is no evidence behind this one yet —
            which is a statement about the record, not about whether the work was done.
          </Note>
        ) : (
          <DataTable
            rows={mine}
            pageSize={10}
            columns={[
              { key: 'filedDate', label: 'Filed', width: 130, render: (f) => <DateVal value={f.filedDate} /> },
              {
                key: '_late', label: 'Against due', width: 160,
                render: (f) => (f._days === null
                  ? <Blank label="No due date" />
                  : (
                    <StatusBadge tone={f._late ? 'amber' : 'green'}>
                      {f._days === 0 ? 'On the day' : f._late ? `${f._days} days late` : `${Math.abs(f._days)} days early`}
                    </StatusBadge>
                  )),
              },
              { key: 'filedBy', label: 'Filed by', width: 170, render: (f) => f.filedBy || <Blank /> },
              {
                key: 'evidenceRef', label: 'Reference', width: 170,
                // The reference points at evidence held elsewhere; the column
                // beside it is evidence held here. Two different claims, kept in
                // two different columns.
                render: (f) => (f.evidenceRef ? <Ref>{f.evidenceRef}</Ref> : <Blank label="None recorded" />),
              },
              {
                key: 'attachments', label: 'Attached', width: 130, sortable: false,
                render: (f) => {
                  const n = attachedTo.get(f.recordId)?.length || 0
                  if (!n) return <Blank label="No files" />
                  return (
                    <span onClick={(e) => e.stopPropagation()}>
                      <ActionButton size="sm" variant="subtle" onClick={() => setViewing(f)}>
                        {n} file{n === 1 ? '' : 's'}
                      </ActionButton>
                    </span>
                  )
                },
              },
              { key: 'note', label: 'Note', render: (f) => <span style={{ fontSize: 11.5, color: '#64748b' }}>{f.note || '—'}</span> },
            ]}
          />
        )}
      </Section>

      {kind === KIND.CONTINUOUS && (
        <Section title="Why this has no due dates">
          <Note tone="grey">
            This is a standing obligation — <b>{r.frequency.toLowerCase()}</b> — so it never
            appears on the compliance calendar. The question it raises is whether the recording
            system is running, not what is due this week. Putting a rule like this on a calendar
            generates tens of thousands of rows a year and tells nobody anything.
          </Note>
        </Section>
      )}

      {kind === KIND.EVENT && (
        <Section title="Why this has no due dates">
          <Note tone="grey">
            This obligation is triggered by an event rather than a date: <b>{r.deadlineRule}</b>.
            It has no due date until that event is scheduled, and inventing one would be exactly
            the fabrication the source workbook warns against.
          </Note>
        </Section>
      )}

      {dated && (
        <Section
          title="Projected occurrences"
          right={<Derived>Computed from the rule</Derived>}
        >
          <Note>
            These dates are worked out from the frequency and deadline above; they are
            projections, not records.
            {mine.length > 0
              ? <> Where one has been filed in the portal, the filing is shown against it.</>
              : <> The source workbook carries no completion history, so none of them has been
                answered yet.</>}
          </Note>
          <DataTable
            rows={occ}
            pageSize={12}
            empty="The deadline rule does not name a date, so no occurrence can be projected from it."
            columns={[
              { key: 'dueDate', label: 'Due', width: 150, render: (o) => fmtDate(o.dueDate) },
              {
                key: 'daysUntil', label: 'Relative', width: 150,
                render: (o) => (
                  <span style={{ color: o.daysUntil < 0 ? '#b91c1c' : '#64748b', fontSize: 12 }}>
                    {o.daysUntil < 0 ? `${Math.abs(o.daysUntil)} days ago` : `in ${o.daysUntil} days`}
                  </span>
                ),
              },
              {
                key: 'status', label: 'Status', width: 160,
                // A projected date somebody has answered is not outstanding, and
                // showing it in red beside three that genuinely are is how a
                // reader is sent to chase something already filed.
                render: (o) => (o._filing
                  ? <StatusBadge tone="green">Filed {fmtDate(o._filing.filedDate)}</StatusBadge>
                  : <StatusBadge tone={o.daysUntil < 0 ? 'red' : o.daysUntil <= 30 ? 'amber' : 'blue'}>{o.status}</StatusBadge>),
              },
              {
                key: 'evidence', label: 'Evidence', width: 190, sortable: false,
                // A projected date can be answered from here, so the reader does
                // not have to walk back to the calendar to file the occurrence
                // they are looking at.
                render: (o) => (
                  <span onClick={(e) => e.stopPropagation()}>
                    {o._filing ? (
                      (attachedTo.get(o._filing.recordId)?.length || 0) > 0
                        ? (
                          <ActionButton size="sm" variant="subtle" onClick={() => setViewing(o._filing)}>
                            {attachedTo.get(o._filing.recordId).length} file
                            {attachedTo.get(o._filing.recordId).length === 1 ? '' : 's'}
                          </ActionButton>
                        )
                        : (o._filing.evidenceRef ? <Ref>{o._filing.evidenceRef}</Ref> : <Blank label="None recorded" />)
                    ) : (
                      <ActionButton size="sm" variant="ghost" onClick={() => setFiling(o)}>Mark filed</ActionButton>
                    )}
                  </span>
                ),
              },
              { key: 'rule', label: 'From rule', render: (o) => <span style={{ fontSize: 11.5, color: '#64748b' }}>{o.rule}</span> },
            ]}
          />
        </Section>
      )}

      <FilingModal subject={filing} onClose={() => setFiling(null)} onFile={fileIt} />

      <EvidenceViewer
        filing={viewing}
        attachments={viewing ? (attachedTo.get(viewing.recordId) || []) : []}
        onClose={() => setViewing(null)}
      />
    </div>
  )
}

// ── shared ───────────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 5, lineHeight: 1.45 }}>{hint}</span>}
    </label>
  )
}

function Row({ k, v, last }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: last ? 'none' : '1px solid #eef2f7' }}>
      <span style={{ fontSize: 11.5, color: '#94a3b8', flex: '0 0 130px' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: '#0f172a', fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}

const box = { padding: '10px 13px', borderRadius: 10, background: '#f8fafc', border: '1px solid #eef2f7' }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}

// Label over value, one field per cell.
//
// This was a two-up row with the label left and the value pushed right by
// space-between, and columnGap:0 — so the value of one field sat flush against
// the next field's label and read as one run ("42-00254AReference"). Stacking
// the label above the value removes the collision, and a real column gap keeps
// adjacent fields apart no matter how wide the value is.
function Grid({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', columnGap: 28, rowGap: 2 }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid #eef1f6', minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{k}</div>
          <div style={{ fontSize: 12.5, color: '#0f172a', overflowWrap: 'anywhere' }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

function NotFound({ what, id, back }) {
  return (
    <div>
      <PageHeading
        back={{ label: 'Back', onClick: back }}
        title={`No ${what} with that reference`}
        subtitle={`Nothing in the trial dataset is filed under “${id}”. It may belong to a site outside the trial, or the reference may have been mistyped.`}
      />
    </div>
  )
}

const linkBtn = { background: 'none', border: 'none', color: '#15227a', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'right' }
