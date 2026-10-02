'use client'

// Training and qualification.
//
// Seven requirements from two different sources, and the difference is worth
// keeping visible. Six come from page 1 of the Safety Checklist and carry no
// frequency at all — required onsite when applicable, not on a renewal cycle.
// The seventh, annual spill and leak prevention, comes from the PAG-03
// stormwater tracker and is a dated regulatory obligation with a matching
// requirement in the compliance register.
//
// What makes it work: a completion can be recorded against a person and a
// course. Where the course carries a frequency the completion is given an
// expiry and the matrix shows when it lapses; where it does not, the completion
// is a competency gate that stands until the person is retrained. That mirrors
// the source distinction rather than inventing an annual cycle onto the six
// blank rows — the distinction a compliance manager actually needs.

import { useMemo, useState } from 'react'
import { Section, DataTable, Toolbar, StatusBadge, Modal, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, TwoLine, Blank, Note, Source } from '../components/cells'
import { useStore, useCreated, USER } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import { TRAINING, requirements, daysUntil, fmtDate, TODAY } from '../lib/data'

// Completion status for a dated course. A course with no expiry is a competency
// gate — valid until retrained — so it has no lapse state at all.
const statusOf = (c) => {
  if (!c.expiryDate) return 'Valid'
  const d = daysUntil(c.expiryDate)
  return d < 0 ? 'Expired' : d <= 60 ? 'Expiring' : 'Valid'
}
const STATUS_TONE = { Valid: 'green', Expiring: 'amber', Expired: 'red' }

// A year on from a completion, for the one course that renews annually. Kept off
// the workbook calendar helper so it is obviously derived from what was entered.
const plusYear = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}
const isAnnual = (t) => /annual/i.test(t?.frequency || '') || /annual/i.test(t?.name || '')

export default function Training() {
  const store = useStore()
  const completions = useCreated('waga_training')

  const [search, setSearch] = useState('')
  const [applies, setApplies] = useState('all')
  const [recording, setRecording] = useState(null)   // training being recorded, or {} for the header button

  const audiences = [...new Set(TRAINING.map((t) => t.appliesTo))].filter(Boolean)

  const byTraining = useMemo(() => {
    const m = new Map()
    for (const c of completions) m.set(c.trainingId, [...(m.get(c.trainingId) || []), c])
    return m
  }, [completions])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return TRAINING.filter((t) => (
      (applies === 'all' || t.appliesTo === applies) &&
      (!q || [t.name, t.appliesTo, t.source].join(' ').toLowerCase().includes(q))
    ))
  }, [search, applies])

  const mandatory = TRAINING.filter((t) => t.required).length
  const linked = requirements.filter((r) => r.category === 'Training')
  const expired = completions.filter((c) => statusOf(c) === 'Expired').length

  const record = async ({ training, person, completionDate, note }) => {
    const expiryDate = isAnnual(training) ? plusYear(completionDate) : ''
    const saved = await store.create('waga_training', {
      trainingId: training.trainingId, trainingName: training.name,
      person: person.trim(), completionDate, expiryDate, note: note.trim(),
    })
    if (saved) {
      await store.log('Training completed', `${training.name} — ${person.trim()}`,
        // No site: a person's competency is held by the organisation, not by
        // one plant, and the matrix on this screen is organisation-wide.
        expiryDate ? `Valid to ${fmtDate(expiryDate)}` : 'Competency (no expiry)', '')
      store.notify(`${person.trim()} — ${training.name} recorded.`)
      setRecording(null)
    }
  }

  return (
    <div>
      <PageHeading
        title="Safety Training & Compliance"
        subtitle="Required training and qualification, who has completed it, and which of it is a permit condition rather than a competency gate."
        right={<ActionButton onClick={() => setRecording({})}>Record completion</ActionButton>}
      />

      <StatCards items={[
        { label: 'Training requirements', value: TRAINING.length, icon: 'people' },
        { label: 'Completions recorded', value: completions.length, tone: completions.length ? 'green' : undefined, note: 'In the portal', icon: 'tick' },
        { label: 'Mandatory courses', value: mandatory, note: 'Required, not task-dependent' },
        { label: 'Expired', value: expired, tone: expired ? 'red' : 'green', note: 'Need retraining' },
        { label: 'Permit-linked', value: linked.length, tone: 'amber', note: 'Also in the register' },
      ]} />

      <Section title="Training matrix">
        <Note tone="grey">
          Six of these come from page 1 of the Safety Checklist, required onsite when applicable
          with no renewal interval — that blank is the source&apos;s. Only the annual spill and leak
          training carries a frequency, so only its completions are given an expiry.
        </Note>

        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search training or audience…"
          filters={[{ label: 'Applies to', value: applies, onChange: setApplies, options: audiences }]}
        />

        <DataTable
          rows={rows}
          pageSize={12}
          empty="No training matches these filters."
          columns={[
            { key: 'trainingId', label: 'Reference', width: 108, render: (t) => <Ref>{t.trainingId}</Ref> },
            { key: 'name', label: 'Training', render: (t) => <TwoLine top={t.name} bottom={t.source} /> },
            { key: 'appliesTo', label: 'Applies to', width: 190 },
            {
              key: 'frequency', label: 'Frequency', width: 128,
              render: (t) => (t.frequency ? t.frequency : <Blank label="When applicable" />),
            },
            {
              key: 'recorded', label: 'Completed', width: 130, sortable: false,
              render: (t) => {
                const cs = byTraining.get(t.trainingId) || []
                if (cs.length === 0) return <span style={{ fontSize: 11.5, color: '#94a3b8' }}>None</span>
                const expired = cs.filter((c) => statusOf(c) === 'Expired').length
                return (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{cs.length}</span>
                    {expired > 0 && <StatusBadge tone="red">{expired} expired</StatusBadge>}
                  </span>
                )
              },
            },
            {
              key: 'act', label: '', width: 104, sortable: false,
              render: (t) => (
                <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
                  <ActionButton size="sm" variant="subtle" onClick={() => setRecording(t)}>Record</ActionButton>
                </span>
              ),
            },
          ]}
        />
      </Section>

      {completions.length > 0 && (
        <Section title="Recorded completions" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>{completions.length} in the portal</span>}>
          <DataTable
            rows={completions}
            pageSize={12}
            empty="No completions recorded."
            columns={[
              { key: 'person', label: 'Person', width: 190, render: (c) => <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.person}</span> },
              { key: 'trainingName', label: 'Training' },
              { key: 'completionDate', label: 'Completed', width: 130, render: (c) => fmtDate(c.completionDate) },
              { key: 'expiryDate', label: 'Expires', width: 130, render: (c) => (c.expiryDate ? fmtDate(c.expiryDate) : <Blank label="No expiry" />) },
              { key: 'status', label: 'Status', width: 120, render: (c) => <StatusBadge tone={STATUS_TONE[statusOf(c)]}>{statusOf(c)}</StatusBadge> },
            ]}
          />
        </Section>
      )}

      {linked.length > 0 && (
        <Section title="Training that is also a permit condition">
          {linked.map((r) => (
            <div key={r.requirementId} style={{ padding: '13px 15px', border: '1px solid #e4e9f0', borderLeft: '3px solid #b45309', borderRadius: 11, background: '#fff', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                <Ref>{r.requirementId}</Ref>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 1.55 }}>
                {r.frequency}{r.deadlineRule ? ` · ${r.deadlineRule}` : ''}
                {r.submissionMethod ? ` · ${r.submissionMethod}` : ''}
              </div>
              {r._permitNumber ? <Source>Permit {r._permitNumber}</Source> : null}
            </div>
          ))}
        </Section>
      )}

      <ModuleActivity
        module="training"
        empty="No training completions have been recorded yet."
      />

      <RecordModal recording={recording} onClose={() => setRecording(null)} onSave={record} />
    </div>
  )
}

/** Record a completion. The course can be pre-selected from a matrix row or picked here. */
function RecordModal({ recording, onClose, onSave }) {
  const preset = recording && recording.trainingId ? recording : null
  const [trainingId, setTrainingId] = useState(preset?.trainingId || TRAINING[0]?.trainingId || '')
  const [person, setPerson] = useState('')
  const [completionDate, setCompletionDate] = useState(TODAY())
  const [note, setNote] = useState('')

  const key = recording ? (preset?.trainingId || 'any') : ''
  const [seen, setSeen] = useState(key)
  if (recording && key !== seen) {
    setSeen(key)
    setTrainingId(preset?.trainingId || TRAINING[0]?.trainingId || '')
    setPerson(''); setCompletionDate(TODAY()); setNote('')
  }
  if (!recording) return null

  const training = TRAINING.find((t) => t.trainingId === trainingId) || TRAINING[0]
  const willExpire = isAnnual(training)
  const valid = person.trim() && completionDate

  return (
    <Modal open={Boolean(recording)} onClose={onClose} title="Record training completion" subtitle={preset ? preset.name : 'Log a completed course'} width={520}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid}
            onClick={() => onSave({ training, person, completionDate, note })}>
            Record completion
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Person" required>
          <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Who completed it" style={input} />
        </Field>
        <Field label="Training">
          <select value={trainingId} onChange={(e) => setTrainingId(e.target.value)} disabled={Boolean(preset)}
            style={{ ...input, ...(preset ? { background: '#f8fafc', color: '#64748b' } : {}) }}>
            {TRAINING.map((t) => <option key={t.trainingId} value={t.trainingId}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Completion date" required>
          <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} style={input} />
        </Field>
        <div style={{ fontSize: 11.5, color: willExpire ? '#b45309' : '#64748b', lineHeight: 1.5 }}>
          {willExpire
            ? `This course renews annually — the completion will be valid to ${completionDate ? fmtDate(plusYear(completionDate)) : 'a year on'}.`
            : 'This course has no stated renewal interval — the completion stands as a competency until the person is retrained.'}
        </div>
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Certificate reference, provider…" style={input} />
        </Field>
      </div>
    </Modal>
  )
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </span>
      {children}
    </label>
  )
}

const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
