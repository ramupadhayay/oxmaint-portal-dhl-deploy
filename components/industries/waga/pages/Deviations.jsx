'use client'

// Deviations and corrective action.
//
// Two of these are the only genuine operational history in the whole dataset.
// V-011 confirms both against WAGA's own Deviance Tracker and notes, in the
// workbook's words, "These are actual customer records, not demo data" — so the
// two seeded rows are never marked derived and never mixed with anything
// generated.
//
// What makes the screen work rather than just display: a deviation can be
// raised here, and any deviation — seeded or raised — can be walked along its
// CAPA path, Open → Corrective Action → Closed. A seeded row is not rewritten in
// the workbook; the change is stored over it and the two are merged for display,
// the same way the filing calendar lays a completion over a projected date. Each
// transition appends to the audit trail, because a corrective-action record you
// can move with no trace behind it is not a CAPA record.

import { useMemo, useState } from 'react'
import { Section, StatusBadge, Modal, ActionButton, Toolbar } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Ref, SiteChip, Blank, Note, Source } from '../components/cells'
import { useSite } from '../lib/siteStore'
import { useStore, useRecords, USER } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import {
  deviations, permits, SITES, siteCode, permitOf, fmtDate, TODAY,
} from '../lib/data'

const STATUS_TONE = { Closed: 'green', 'Corrective Action': 'amber', Open: 'red' }
const idOf = (d) => d.deviationId || d.recordId
// The permit register's key, for the permit picker in the report form.
const idOfPermit = (p) => p.permitId

// The workbook's abbreviations for how a deviation was caught. RR is a routine
// report, ST a stack test — spelled out here so a raised one can be described in
// the same terms the two real ones use.
const DETECTION = ['Routine report (RR)', 'Stack test (ST)', 'Inspection', 'Continuous monitoring', 'Self-audit', 'Agency notice', 'Other']

export default function Deviations() {
  const { scope, siteName, codeOf, emptyFor } = useSite()
  const store = useStore()

  const merged = useRecords('waga_deviation', deviations, idOf)
  // A raised deviation carries only ids; give it the same derived context the
  // seeded ones are enriched with, so the card reads the same either way.
  const all = useMemo(() => scope(merged.map((d) => ({
    ...d,
    _siteCode: d._siteCode || codeOf(d.siteId) || siteCode(d.siteId),
    _permit: d._permit || permitOf(d.permitId),
  }))), [scope, merged])

  const [reporting, setReporting] = useState(false)
  const [closing, setClosing] = useState(null)   // the deviation being closed
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((d) => (
      (filter === 'All' || d.status === filter)
      && (!q || [d.description, d.cause, d.correctiveAction, d.deviationId].filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, filter])

  const open = all.filter((d) => d.status !== 'Closed')

  const advance = async (d, status, extra = {}) => {
    // A record still saving has a temporary recordId the server is about to
    // replace; patching it now files a second row beside the real one. Rare, but
    // a fast click can hit it — so the action waits for it to settle.
    if (d._pending) { store.notify('Still saving — try again in a moment.'); return }
    // Key by the record's own id when it has one — a deviation raised here is
    // stored under a generated recordId (wgd_…), not its DEV-… number, and
    // patching by the number instead would file a second row beside it and
    // collide on the display key. A seeded row has no recordId, so its DEV-…
    // number is the key and the patch upserts a row under it.
    const saved = await store.update('waga_deviation', d.recordId || idOf(d), { ...pluck(d), status, ...extra })
    if (saved) {
      await store.log(`Deviation → ${status}`, `${d.deviationId} · ${d.description}`.slice(0, 120),
        extra.closureNote ? `Closed: ${extra.closureNote}` : extra.correctiveAction ? `Action: ${extra.correctiveAction}` : '', d.siteId)
      store.notify(`${d.deviationId} moved to ${status}.`)
    }
  }

  return (
    <div>
      <PageHeading
        title="Deviations, Investigation & Corrective Action"
        subtitle={`Regulatory deviations, their cause, the corrective action taken and its closure — ${siteName}.`}
        right={<ActionButton onClick={() => setReporting(true)}>Report deviation</ActionButton>}
      />

      <StatCards items={[
        { label: 'Recorded', value: all.length, note: 'Two from the Deviance Tracker', icon: 'list' },
        { label: 'Closed', value: all.filter((d) => d.status === 'Closed').length, tone: 'green', icon: 'tick' },
        { label: 'Open / in corrective action', value: open.length, tone: open.length ? 'amber' : 'green', icon: 'clock' },
        { label: 'Sites affected', value: new Set(all.map((d) => d.siteId)).size, icon: 'site' },
      ]} />

      <Note>
        The two rows carried from WAGA&apos;s Deviance Tracker are reproduced as written and are
        not derived. A deviation raised here, or a status moved along its CAPA path, is stored
        over that record and written to the audit trail — the workbook itself is not edited.
      </Note>

      <Toolbar
        search={search} onSearch={setSearch}
        placeholder="Search description, cause or corrective action…"
        filters={[{ label: 'Status', value: filter, onChange: setFilter, options: ['All', 'Open', 'Corrective Action', 'Closed'] }]}
      />

      {rows.length === 0 && (
        <Section title="Deviations">
          <div style={{ padding: '32px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
            {all.length === 0
              ? emptyFor('No deviations recorded for this site.', 'deviations', 'Report deviation')
              : 'No deviations match these filters.'}
          </div>
        </Section>
      )}

      {rows.map((d) => (
        <Section
          key={idOf(d)}
          title={d.description}
          right={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {d._raised && <span style={chip}>Raised in portal</span>}
              <StatusBadge tone={STATUS_TONE[d.status] || 'grey'}>{d.status}</StatusBadge>
            </div>
          )}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <Ref>{d.deviationId}</Ref>
            <SiteChip code={d._siteCode} />
            <span style={{ fontSize: 11.5, color: '#64748b' }}>
              Event date <b style={{ color: '#0f172a' }}>{fmtDate(d.eventDate)}</b>
            </span>
            {d.duration && d.duration !== 'NA' ? <span style={{ fontSize: 11.5, color: '#64748b' }}>Duration {d.duration}</span> : null}
            {d._permit ? <span style={{ fontSize: 11.5, color: '#64748b' }}>Permit {d._permit.permitNumber}</span> : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            <Block title="Cause" tone="#b45309">{d.cause || <Blank />}</Block>
            <Block title="Corrective action" tone="#047857">{d.correctiveAction || <span style={{ color: '#94a3b8' }}>Not yet recorded.</span>}</Block>
          </div>

          {d.monitoringMethod ? (
            <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
              <b style={{ color: '#334155' }}>Detected by: </b>{d.monitoringMethod}
            </div>
          ) : null}

          {d.status === 'Closed' && d.closureNote ? (
            <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 9, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#047857' }}>
                Closed {d.closedDate ? `· ${fmtDate(d.closedDate)}` : ''} {d.closedBy ? `· ${d.closedBy}` : ''}
              </div>
              <div style={{ fontSize: 12.5, color: '#0f172a', marginTop: 6, lineHeight: 1.55 }}>{d.closureNote}</div>
            </div>
          ) : null}

          {/* The CAPA controls, gated on where the deviation is. A workbook row
              moves the same way a raised one does. */}
          {d.status !== 'Closed' && !d._pending && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {d.status === 'Open' && (
                <ActionButton size="sm" variant="subtle"
                  onClick={() => advance(d, 'Corrective Action')}>
                  Start corrective action
                </ActionButton>
              )}
              <ActionButton size="sm" variant="success" onClick={() => setClosing(d)}>Close deviation</ActionButton>
            </div>
          )}

          <Source>{d.source}</Source>
        </Section>
      ))}

      <ModuleActivity
        module="deviations"
        empty="No deviation has been raised or moved along CAPA in the portal yet."
      />

      <ReportModal
        open={reporting}
        onClose={() => setReporting(false)}
        existing={all}
        onSave={async (payload) => {
          const saved = await store.create('waga_deviation', payload)
          if (saved) {
            await store.log('Deviation raised', `${payload.deviationId} · ${payload.description}`.slice(0, 120), payload.cause || '', payload.siteId)
            store.notify(`Deviation ${payload.deviationId} raised.`)
            setReporting(false)
          }
        }}
      />

      <CloseModal
        deviation={closing}
        onClose={() => setClosing(null)}
        onCloseOut={async ({ closureNote, closedDate, correctiveAction }) => {
          await advance(closing, 'Closed', {
            closureNote, closedDate, closedBy: USER.name,
            ...(correctiveAction ? { correctiveAction } : {}),
          })
          setClosing(null)
        }}
      />
    </div>
  )
}

// The fields a stored patch has to carry so the merged card stays complete —
// update() writes the whole `data` object, so a status flip that dropped these
// would blank the card on the next read.
function pluck(d) {
  return {
    deviationId: d.deviationId, siteId: d.siteId, permitId: d.permitId || '',
    description: d.description, eventDate: d.eventDate, duration: d.duration || '',
    monitoringMethod: d.monitoringMethod || '', cause: d.cause || '',
    correctiveAction: d.correctiveAction || '', source: d.source || 'WAGA portal',
    _raised: d._raised || false,
  }
}

/** Raise a deviation. Starts Open; corrective action can be blank at this point. */
function ReportModal({ open, onClose, existing, onSave }) {
  // Every site the portal knows and every permit — the workbook's and any added
  // in the portal. The form offered the workbook's two sites and its permits
  // only, so a deviation could not be raised against a site or a permit that had
  // been added here: the entry the person meant to make had nowhere to go.
  const { sites: siteList, newRecordSiteId } = useSite()
  const allPermits = useRecords('waga_permit_event', permits, idOfPermit)
  const [siteId, setSiteId] = useState(newRecordSiteId)
  const [permitId, setPermitId] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState(TODAY())
  const [detection, setDetection] = useState(DETECTION[0])
  const [cause, setCause] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setSiteId(newRecordSiteId); setPermitId(''); setDescription('')
      setEventDate(TODAY()); setDetection(DETECTION[0]); setCause(''); setCorrectiveAction('')
    }
  }

  const sitePermits = allPermits.filter((p) => p.siteId === siteId)
  const valid = description.trim() && siteId

  const nextId = () => {
    // A site added in the portal has no workbook code to look up.
    const code = siteCode(siteId) || siteList.find((s) => s.siteId === siteId)?.code || 'SITE'
    const n = existing.filter((d) => (d.siteId === siteId)).length + 1
    return `DEV-${code}-${String(n).padStart(3, '0')}`
  }

  return (
    <Modal open={open} onClose={onClose} title="Report a deviation" subtitle="Starts open — corrective action can follow" width={560}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid}
            onClick={() => onSave({
              deviationId: nextId(), siteId, permitId,
              description: description.trim(), eventDate,
              monitoringMethod: detection, duration: 'NA',
              cause: cause.trim(), correctiveAction: correctiveAction.trim(),
              status: 'Open', source: 'WAGA portal', _raised: true,
            })}>
            Raise deviation
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="What happened" required>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Late semi-annual report to the agency" style={{ ...input, resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Site" required>
            <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setPermitId('') }} style={input}>
              {siteList.map((s) => <option key={s.siteId} value={s.siteId}>{s.code} — {s.siteName}</option>)}
            </select>
          </Field>
          <Field label="Permit (optional)">
            <select value={permitId} onChange={(e) => setPermitId(e.target.value)} style={input}>
              <option value="">Not tied to one permit</option>
              {sitePermits.map((p) => <option key={p.permitId} value={p.permitId}>{p.permitNumber} — {p.permitTitle}</option>)}
            </select>
          </Field>
          <Field label="Event date">
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={input} />
          </Field>
          <Field label="Detected by">
            <select value={detection} onChange={(e) => setDetection(e.target.value)} style={input}>
              {DETECTION.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Cause">
          <textarea rows={2} value={cause} onChange={(e) => setCause(e.target.value)}
            placeholder="Why it happened, as far as known." style={{ ...input, resize: 'vertical' }} />
        </Field>
        <Field label="Corrective action (optional at this stage)">
          <textarea rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)}
            placeholder="What is being done about it." style={{ ...input, resize: 'vertical' }} />
        </Field>
      </div>
    </Modal>
  )
}

/** Close a deviation — a closure note is required, and a corrective action must exist. */
function CloseModal({ deviation, onClose, onCloseOut }) {
  const [closureNote, setClosureNote] = useState('')
  const [closedDate, setClosedDate] = useState(TODAY())
  const [correctiveAction, setCorrectiveAction] = useState('')

  const key = deviation ? idOf(deviation) : ''
  const [seen, setSeen] = useState(key)
  if (key !== seen) {
    setSeen(key)
    setClosureNote(''); setClosedDate(TODAY()); setCorrectiveAction(deviation?.correctiveAction || '')
  }

  if (!deviation) return null
  const needsAction = !deviation.correctiveAction && !correctiveAction.trim()
  const valid = closureNote.trim() && !needsAction

  return (
    <Modal open={Boolean(deviation)} onClose={onClose} title="Close deviation" subtitle={deviation.description} width={520}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="success" disabled={!valid}
            onClick={() => onCloseOut({
              closureNote: closureNote.trim(), closedDate,
              correctiveAction: correctiveAction.trim() || undefined,
            })}>
            Close deviation
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!deviation.correctiveAction && (
          <Field label="Corrective action" required hint="What was done to correct it — a deviation cannot close without one.">
            <textarea rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="e.g. Report submitted 2026-10-24; reminder rule added." style={{ ...input, resize: 'vertical' }} />
          </Field>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Closed date">
            <input type="date" value={closedDate} onChange={(e) => setClosedDate(e.target.value)} style={input} />
          </Field>
        </div>
        <Field label="Closure note" required hint="What confirms it is resolved and what stops it recurring.">
          <textarea rows={3} value={closureNote} onChange={(e) => setClosureNote(e.target.value)}
            placeholder="How closure was verified." style={{ ...input, resize: 'vertical' }} />
        </Field>
      </div>
    </Modal>
  )
}

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

function Block({ title, tone, children }) {
  return (
    <div style={{ padding: '12px 14px', border: '1px solid #e4e9f0', borderLeft: `3px solid ${tone}`, borderRadius: 10, background: '#fff' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: tone }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#0f172a', marginTop: 7, lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}

const chip = {
  fontSize: 10.5, fontWeight: 700, color: '#3640d8', background: '#eef1ff',
  padding: '2px 9px', borderRadius: 999, border: '1px solid #dbe2ff',
}
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
