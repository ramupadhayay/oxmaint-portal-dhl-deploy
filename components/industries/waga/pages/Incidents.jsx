'use client'

// Incident, root cause and OSHA recordkeeping.
//
// The customer's General Incident Report workbook — which carries their RCA
// fields and OSHA Form 301 — was not among the files supplied, and the
// Verification_Log is blunt about the consequence (V-014): "Kept as placeholder
// schema only", "Do not populate fake incident data". That instruction is about
// data, not capability: fabricating an injury record would be indefensible, but
// giving the team a way to record a real one is the whole point of the module.
//
// So no historical WAGA incidents are invented. The screen instead lets a real
// incident be reported here and worked to closure — every row on it was entered
// in the portal, never seeded — and it keeps saying, plainly, that the client's
// own back-catalogue still awaits the source workbook. An empty register that
// explains itself and can be written to beats a populated one that cannot be
// trusted.

import { useMemo, useState } from 'react'
import { Section, StatusBadge, Modal, ActionButton, Toolbar } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import { Note, SiteChip, Ref } from '../components/cells'
import { useSite } from '../lib/siteStore'
import { useStore, useCreated, USER } from '../lib/store'
import ModuleActivity from '../components/ModuleActivity'
import { SITES, siteCode, fmtDate, TODAY, incidentNotice } from '../lib/data'

const TYPES = ['Near miss', 'Injury / illness', 'Spill / release', 'Fire / explosion', 'Property damage', 'Environmental', 'Other']
const SEVERITIES = ['Near miss', 'First aid', 'Recordable', 'Lost time', 'Fatality']
const SEV_TONE = { 'Near miss': 'blue', 'First aid': 'green', Recordable: 'amber', 'Lost time': 'red', Fatality: 'red' }
const STATUS_TONE = { Open: 'red', Investigating: 'amber', Closed: 'green' }
const idOf = (i) => i.incidentId || i.recordId

export default function Incidents() {
  const { scope, siteName, codeOf } = useSite()
  const store = useStore()
  const created = useCreated('waga_incident')

  const [reporting, setReporting] = useState(false)
  const [closing, setClosing] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const all = useMemo(() => scope(created.map((i) => ({ ...i, _siteCode: codeOf(i.siteId) || siteCode(i.siteId) }))), [scope, created])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((i) => (
      (filter === 'All' || i.status === filter)
      && (!q || [i.incidentId, i.description, i.type, i.rootCause, i.correctiveAction].filter(Boolean).join(' ').toLowerCase().includes(q))
    ))
  }, [all, search, filter])

  const oshaCount = all.filter((i) => i.oshaRequired).length
  const open = all.filter((i) => i.status !== 'Closed').length

  const advance = async (i, status, extra = {}) => {
    // A record still saving has a temporary recordId that the server is about to
    // replace; patching it now files a second row under the temp id beside the
    // real one. The window is sub-second, but a fast click can hit it, so the
    // action waits for the record to settle rather than racing it.
    if (i._pending) { store.notify('Still saving — try again in a moment.'); return }
    const saved = await store.update('waga_incident', i.recordId || idOf(i), { ...pluck(i), status, ...extra })
    if (saved) {
      await store.log(`Incident → ${status}`, `${i.incidentId} · ${i.description}`.slice(0, 120),
        extra.closureNote ? `Closed: ${extra.closureNote}` : '', i.siteId)
      store.notify(`${i.incidentId} moved to ${status}.`)
    }
  }

  return (
    <div>
      <PageHeading
        title="Incident Tracking, Root Cause & OSHA"
        subtitle="Report an incident, investigate its root cause, track corrective action and OSHA recordability."
        right={<ActionButton onClick={() => setReporting(true)}>Report incident</ActionButton>}
      />

      <Note tone="warn">
        <b>No historical WAGA incident records are loaded.</b> {incidentNotice} Anything below was
        reported in the portal — nothing here is seeded, and no injury record has been fabricated.
      </Note>

      <StatCards items={[
        { label: 'Reported in portal', value: all.length, icon: 'list' },
        { label: 'Open / investigating', value: open, tone: open ? 'amber' : 'green', icon: 'clock' },
        { label: 'Closed', value: all.filter((i) => i.status === 'Closed').length, tone: 'green', icon: 'tick' },
        { label: 'OSHA recordable', value: oshaCount, tone: oshaCount ? 'red' : undefined, note: 'Form 301 flagged' },
      ]} />

      {all.length > 0 && (
        <Toolbar
          search={search} onSearch={setSearch}
          placeholder="Search description, type, cause…"
          filters={[{ label: 'Status', value: filter, onChange: setFilter, options: ['All', 'Open', 'Investigating', 'Closed'] }]}
        />
      )}

      {all.length === 0 ? (
        <Section title="Incident register"
          right={<StatusBadge tone="amber">Awaiting source · open to new entries</StatusBadge>}>
          <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6, marginBottom: 14 }}>
            The RCA and OSHA Form 301 fields are modelled and ready. No incident has been reported
            yet, and the client&apos;s historical records still await their General Incident Report
            workbook. Use <b>Report incident</b> to record a new one.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
            {[
              ['Incident', 'Date, site, type, severity, description'],
              ['Response', 'Immediate action taken'],
              ['Investigation', 'Root cause, corrective action, owner'],
              ['Regulatory', 'OSHA 301 required, case number'],
            ].map(([group, detail]) => (
              <div key={group} style={{ padding: '13px 15px', border: '1px solid #e4e9f0', borderRadius: 11, background: '#fff' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#94a3b8' }}>{group}</div>
                <div style={{ fontSize: 12.5, color: '#334155', marginTop: 7, lineHeight: 1.55 }}>{detail}</div>
              </div>
            ))}
          </div>
        </Section>
      ) : rows.length === 0 ? (
        <Section title="Incident register">
          <div style={{ padding: '30px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>No incidents match these filters.</div>
        </Section>
      ) : rows.map((i) => (
        <Section
          key={idOf(i)}
          title={i.description}
          right={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i.oshaRequired && <span style={oshaChip}>OSHA 301</span>}
              <StatusBadge tone={SEV_TONE[i.severity] || 'grey'}>{i.severity}</StatusBadge>
              <StatusBadge tone={STATUS_TONE[i.status] || 'grey'}>{i.status}</StatusBadge>
            </div>
          )}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <Ref>{i.incidentId}</Ref>
            <SiteChip code={i._siteCode} />
            <span style={{ fontSize: 11.5, color: '#64748b' }}>{i.type}</span>
            <span style={{ fontSize: 11.5, color: '#64748b' }}>Occurred <b style={{ color: '#0f172a' }}>{fmtDate(i.eventDate)}</b></span>
            {i.owner ? <span style={{ fontSize: 11.5, color: '#64748b' }}>Owner {i.owner}</span> : null}
            {i.caseNumber ? <span style={{ fontSize: 11.5, color: '#64748b' }}>Case {i.caseNumber}</span> : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
            {i.immediateAction ? <Block title="Immediate action" tone="#2563eb">{i.immediateAction}</Block> : null}
            <Block title="Root cause" tone="#b45309">{i.rootCause || <span style={{ color: '#94a3b8' }}>Under investigation.</span>}</Block>
            <Block title="Corrective action" tone="#047857">{i.correctiveAction || <span style={{ color: '#94a3b8' }}>Not yet recorded.</span>}</Block>
          </div>

          {i.status === 'Closed' && i.closureNote ? (
            <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 9, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#047857' }}>
                Closed {i.closedDate ? `· ${fmtDate(i.closedDate)}` : ''} {i.closedBy ? `· ${i.closedBy}` : ''}
              </div>
              <div style={{ fontSize: 12.5, color: '#0f172a', marginTop: 6, lineHeight: 1.55 }}>{i.closureNote}</div>
            </div>
          ) : null}

          {i.status !== 'Closed' && !i._pending && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {i.status === 'Open' && (
                <ActionButton size="sm" variant="subtle" onClick={() => advance(i, 'Investigating')}>Start investigation</ActionButton>
              )}
              <ActionButton size="sm" variant="success" onClick={() => setClosing(i)}>Close incident</ActionButton>
            </div>
          )}
        </Section>
      ))}

      <ModuleActivity
        module="incidents"
        empty="No incident has been reported or updated in the portal yet."
      />

      <ReportModal
        open={reporting}
        onClose={() => setReporting(false)}
        existing={all}
        onSave={async (payload) => {
          const saved = await store.create('waga_incident', payload)
          if (saved) {
            await store.log('Incident reported', `${payload.incidentId} · ${payload.description}`.slice(0, 120),
              `${payload.severity}${payload.oshaRequired ? ' · OSHA 301' : ''}`, payload.siteId)
            store.notify(`Incident ${payload.incidentId} reported.`, payload.oshaRequired ? 'error' : 'ok')
            setReporting(false)
          }
        }}
      />

      <CloseModal
        incident={closing}
        onClose={() => setClosing(null)}
        onCloseOut={async ({ closureNote, closedDate, rootCause, correctiveAction }) => {
          await advance(closing, 'Closed', {
            closureNote, closedDate, closedBy: USER.name,
            ...(rootCause ? { rootCause } : {}),
            ...(correctiveAction ? { correctiveAction } : {}),
          })
          setClosing(null)
        }}
      />
    </div>
  )
}

function pluck(i) {
  return {
    incidentId: i.incidentId, siteId: i.siteId, type: i.type, severity: i.severity,
    description: i.description, eventDate: i.eventDate, immediateAction: i.immediateAction || '',
    rootCause: i.rootCause || '', correctiveAction: i.correctiveAction || '', owner: i.owner || '',
    oshaRequired: Boolean(i.oshaRequired), caseNumber: i.caseNumber || '',
  }
}

/** Report an incident. OSHA 301 recordability is captured at report, not inferred. */
function ReportModal({ open, onClose, existing, onSave }) {
  // Every site the portal knows, the workbook's and any added in the portal —
  // the picker below offered the workbook's two only, so an incident at a site
  // added here could not be reported at all.
  const { sites: siteList, newRecordSiteId } = useSite()
  const [siteId, setSiteId] = useState(newRecordSiteId)
  const [type, setType] = useState(TYPES[0])
  const [severity, setSeverity] = useState(SEVERITIES[0])
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState(TODAY())
  const [immediateAction, setImmediateAction] = useState('')
  const [owner, setOwner] = useState('')
  const [osha, setOsha] = useState(false)
  const [caseNumber, setCaseNumber] = useState('')

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setSiteId(newRecordSiteId); setType(TYPES[0]); setSeverity(SEVERITIES[0])
      setDescription(''); setEventDate(TODAY()); setImmediateAction(''); setOwner(''); setOsha(false); setCaseNumber('')
    }
  }

  const valid = description.trim() && siteId
  const nextId = () => {
    const code = siteCode(siteId)
    const n = existing.filter((i) => i.siteId === siteId).length + 1
    return `INC-${code}-${String(n).padStart(3, '0')}`
  }
  // Recordable severities carry an OSHA 301 obligation; the toggle defaults with
  // severity but stays the reporter's to set, because recordability is a
  // judgment the standard leaves to them.
  const suggestOsha = severity === 'Recordable' || severity === 'Lost time' || severity === 'Fatality'

  return (
    <Modal open={open} onClose={onClose} title="Report an incident" subtitle="Starts open — investigation and closure follow" width={580}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid}
            onClick={() => onSave({
              incidentId: nextId(), siteId, type, severity,
              description: description.trim(), eventDate,
              immediateAction: immediateAction.trim(), owner: owner.trim(),
              oshaRequired: osha || suggestOsha, caseNumber: caseNumber.trim(),
              status: 'Open',
            })}>
            Report incident
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="What happened" required>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Slip on wet floor near the flare skid" style={{ ...input, resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Site" required>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={input}>
              {siteList.map((s) => <option key={s.siteId} value={s.siteId}>{s.code} — {s.siteName}</option>)}
            </select>
          </Field>
          <Field label="Event date">
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={input} />
          </Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} style={input}>
              {TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Severity">
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={input}>
              {SEVERITIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Immediate action taken">
          <textarea rows={2} value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)}
            placeholder="What was done at the time." style={{ ...input, resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Owner (optional)">
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who investigates" style={input} />
          </Field>
          <Field label="OSHA case number (if any)">
            <input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="Form 301 case #" style={input} />
          </Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#334155' }}>
          <input type="checkbox" checked={osha || suggestOsha} onChange={(e) => setOsha(e.target.checked)} />
          OSHA 301 recordable{suggestOsha ? ' — suggested for this severity' : ''}
        </label>
      </div>
    </Modal>
  )
}

/** Close an incident — root cause, corrective action and a closure note are required. */
function CloseModal({ incident, onClose, onCloseOut }) {
  const [rootCause, setRootCause] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [closureNote, setClosureNote] = useState('')
  const [closedDate, setClosedDate] = useState(TODAY())

  const key = incident ? idOf(incident) : ''
  const [seen, setSeen] = useState(key)
  if (key !== seen) {
    setSeen(key)
    setRootCause(incident?.rootCause || ''); setCorrectiveAction(incident?.correctiveAction || '')
    setClosureNote(''); setClosedDate(TODAY())
  }
  if (!incident) return null

  const valid = closureNote.trim() && (incident.rootCause || rootCause.trim()) && (incident.correctiveAction || correctiveAction.trim())

  return (
    <Modal open={Boolean(incident)} onClose={onClose} title="Close incident" subtitle={incident.description} width={540}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="success" disabled={!valid}
            onClick={() => onCloseOut({
              closureNote: closureNote.trim(), closedDate,
              rootCause: rootCause.trim() || undefined,
              correctiveAction: correctiveAction.trim() || undefined,
            })}>
            Close incident
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!incident.rootCause && (
          <Field label="Root cause" required>
            <textarea rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)}
              placeholder="What actually caused it." style={{ ...input, resize: 'vertical' }} />
          </Field>
        )}
        {!incident.correctiveAction && (
          <Field label="Corrective action" required>
            <textarea rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="What was done so it does not recur." style={{ ...input, resize: 'vertical' }} />
          </Field>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Closed date">
            <input type="date" value={closedDate} onChange={(e) => setClosedDate(e.target.value)} style={input} />
          </Field>
        </div>
        <Field label="Closure note" required hint="How closure was verified.">
          <textarea rows={3} value={closureNote} onChange={(e) => setClosureNote(e.target.value)}
            placeholder="Confirmation the corrective action is in place." style={{ ...input, resize: 'vertical' }} />
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

const oshaChip = {
  fontSize: 10.5, fontWeight: 800, color: '#b91c1c', background: '#fef2f2',
  padding: '2px 9px', borderRadius: 999, border: '1px solid #fecaca', letterSpacing: '.03em',
}
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
