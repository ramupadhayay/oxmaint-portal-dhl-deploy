'use client'

// The Pre-Task Safety Assessment (JSA).
//
// This screen does two things. It lets a crew fill and submit a real assessment
// — a digital trial workflow mapped from the supplied WAGA Safety Checklist,
// carrying the general and emergency information, PPE, risks, controls, permits,
// authorisation and end-of-work review the five-page form works through. And it
// keeps the workbook's own Safety_Checklist_Template rows below it, the simplified
// import schema, so a reviewer can see which fields the import captured and how
// the digital workflow maps onto them.
//
// The option lists on the risk, permit, training and LOTO selectors are read
// straight from the workbook's own field definitions rather than retyped, so a
// submitted JSA can only carry the hazards and controls the source form lists.
// PPE and the end-of-work checks are the digital workflow's own — blank choices
// for the crew to tick, not values carried from the workbook.

import { useMemo, useState } from 'react'
import { Section, StatusBadge, Modal, ActionButton } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { Note } from '../components/cells'
import { useStore, useCreated, USER } from '../lib/store'
import { useSite } from '../lib/siteStore'
import ModuleActivity from '../components/ModuleActivity'
import { safetyBySection, optionList, SAFETY_FIELDS, SITES, fmtDate, TODAY } from '../lib/data'

const TYPE_LABEL = {
  date: 'Date', text: 'Single line', long_text: 'Paragraph', boolean: 'Yes / No',
  multi_select: 'Multi-select', repeatable_text: 'Repeatable', signature_list: 'Signatures',
  tri_state: 'Yes / N/A', repeatable_grid: 'Grid',
}
const MATRIX_SECTION = 'Task Hazard Analysis'

// The workbook's own option lists, pulled by field label so a selector can only
// offer what the source form lists.
const optionsFor = (needle) => {
  const f = SAFETY_FIELDS.find((x) => x.label.toLowerCase().includes(needle))
  return f ? optionList(f) : []
}
const GENERAL_RISKS = optionsFor('general risk')
const ACTIVITY_RISKS = optionsFor('specific risk')
const PERMITS = optionsFor('permit')
const LOTO_TYPES = optionsFor('loto')
const REQUIRED_TRAINING = optionsFor('required training')

// PPE and the end-of-work checks are not columns in the workbook's simplified
// template — they are part of the five-page paper checklist the digital
// workflow maps onto. They are offered here as blank choices for the crew to
// tick, not as any value carried from the workbook.
const PPE_OPTIONS = [
  'Hard hat', 'Safety glasses', 'Face shield', 'Hearing protection',
  'Work gloves', 'Chemical-resistant gloves', 'Steel-toe boots', 'Hi-vis clothing',
  'FR clothing', 'Gas monitor (H₂S / O₂ / LEL)', 'Respirator (APR / SCBA)', 'Fall-arrest harness',
]
const END_OF_WORK = [
  'Site cleaned', 'Equipment secured', 'Task finished', 'Permits returned', 'Incidents reported',
]
const YES_NO_NA = ['Yes', 'No', 'N/A']

export default function PreTask() {
  const store = useStore()
  const { scope, scopeName, level } = useSite()
  // Assessments written before the form carried a site have none, and a record
  // with no site is in scope everywhere — the rule the rest of the portal uses.
  const jsas = scope(useCreated('waga_jsa'))
  const [filling, setFilling] = useState(false)
  const [openId, setOpenId] = useState(null)

  const open = jsas.find((j) => j.recordId === openId) || null

  return (
    <div>
      <PageHeading
        title="Pre-Task Safety Assessment"
        subtitle="General and emergency information, PPE, risks, controls, permits, work authorisation and the end-of-work review — a digital trial workflow mapped from the supplied WAGA Safety Checklist."
        right={<ActionButton onClick={() => setFilling(true)}>New assessment</ActionButton>}
      />

      <Note tone={jsas.length ? 'info' : 'warn'}>
        {jsas.length
          ? 'Assessments below were completed in the portal. The form is a digital trial workflow mapped from the supplied WAGA Safety Checklist; the workbook’s own Safety_Checklist_Template rows are kept beneath it as the import schema.'
          : 'No completed assessment was supplied with the trial data. Use New assessment to fill one — a digital trial workflow mapped from the supplied WAGA Safety Checklist. The workbook’s own template rows are kept beneath it as the import schema.'}
      </Note>

      <Section title="Completed assessments" right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>{jsas.length} recorded</span>}>
        {jsas.length === 0 ? (
          <div style={{ padding: '26px 14px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
            {level === 'all'
              ? 'None yet — a submitted assessment appears here with its hazards, controls and crew acknowledgement.'
              : `None for ${scopeName} yet. New assessment opens on this site.`}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {jsas.map((j) => (
              <button key={j.recordId} onClick={() => setOpenId(j.recordId)} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere' }}>{j.workDescription}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                      {j.jsaId} · {j.location} · {fmtDate(j.date)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={miniChip}>{(j.tasks || []).length} hazards</span>
                    <span style={miniChip}>{(j.permits || []).length} permits</span>
                    <StatusBadge tone="green">Submitted</StatusBadge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      <div style={{ margin: '24px 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#15227a', whiteSpace: 'nowrap' }}>Workbook import schema</div>
        <div style={{ flex: 1, height: 1, background: '#e4e9f0' }} />
        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Safety_Checklist_Template rows, as the import captured them</span>
      </div>

      {safetyBySection.map(({ section, fields }) => (
        <Section
          key={section}
          title={section}
          right={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>Checklist p{[...new Set(fields.map((f) => f.sourcePage))].join(', ')}</span>}
        >
          {section === MATRIX_SECTION ? (
            <Matrix fields={fields} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
              {fields.map((f) => <SchemaField key={f.fieldId} field={f} />)}
            </div>
          )}
        </Section>
      ))}

      <ModuleActivity
        module="pre-task"
        empty="No pre-task assessments have been submitted yet."
      />

      <JsaModal open={filling} existing={jsas} onClose={() => setFilling(false)}
        onSave={async (payload) => {
          const saved = await store.create('waga_jsa', payload)
          if (saved) {
            await store.log('JSA submitted', `${payload.jsaId} · ${payload.workDescription}`.slice(0, 120),
              `${(payload.tasks || []).length} hazards · ${(payload.permits || []).join(', ') || 'no permits'}`, payload.siteId)
            store.notify(`Assessment ${payload.jsaId} submitted.`)
            setFilling(false)
          }
        }} />

      <JsaView jsa={open} onClose={() => setOpenId(null)} />
    </div>
  )
}

/**
 * Fill and submit a JSA.
 *
 * The form is a digital trial workflow mapped from the five-page WAGA Safety
 * Checklist — general and emergency information, PPE, risks, controls, permits,
 * work authorisation and the end-of-work review. The risk, permit, training and
 * LOTO selectors offer only the workbook's own option lists; PPE and the
 * end-of-work checks are blank choices for the crew to tick.
 */
function JsaModal({ open, existing, onClose, onSave }) {
  // An assessment belongs to a site, and it did not: the form carried a free
  // text "Location" pre-filled with the first workbook site's name and nothing
  // the scope filter could read, so every assessment was organisation-wide and
  // a site added in the portal could never have one of its own.
  const { sites: siteList, newRecordSiteId } = useSite()
  const siteNameOf = (id) => siteList.find((s) => s.siteId === id)?.siteName || ''

  const [date, setDate] = useState(TODAY())
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [siteId, setSiteId] = useState(newRecordSiteId)
  const [location, setLocation] = useState(siteNameOf(newRecordSiteId))
  const [workDescription, setWorkDescription] = useState('')
  const [contractorCompany, setContractorCompany] = useState('')
  const [contractorSupervisor, setContractorSupervisor] = useState('')
  const [wagaContact, setWagaContact] = useState('')
  const [firstAid, setFirstAid] = useState(true)
  const [emWagaQhse, setEmWagaQhse] = useState('')
  const [emContractor, setEmContractor] = useState('')
  const [musterPoint, setMusterPoint] = useState('')
  const [medicalFacility, setMedicalFacility] = useState('')
  const [generalRisks, setGeneralRisks] = useState([])
  const [activityRisks, setActivityRisks] = useState([])
  const [ppe, setPpe] = useState([])
  const [permits, setPermits] = useState([])
  const [training, setTraining] = useState([])
  const [tasks, setTasks] = useState([{ task: '', hazard: '', control: '' }])
  const [lotoTypes, setLotoTypes] = useState([])
  const [weather, setWeather] = useState('')
  const [reviewedWithCrew, setReviewedWithCrew] = useState(true)
  const [crew, setCrew] = useState('')
  const [supervisorName, setSupervisorName] = useState('')
  const [supervisorSign, setSupervisorSign] = useState('')
  const [contractorLead, setContractorLead] = useState('')
  const [contractorSign, setContractorSign] = useState('')
  const [endOfWork, setEndOfWork] = useState({})
  const [safetyNotes, setSafetyNotes] = useState('')

  const [seen, setSeen] = useState(open)
  if (open !== seen) {
    setSeen(open)
    if (open) {
      setDate(TODAY()); setStartTime(''); setEndTime('')
      setSiteId(newRecordSiteId); setLocation(siteNameOf(newRecordSiteId)); setWorkDescription('')
      setContractorCompany(''); setContractorSupervisor(''); setWagaContact('')
      setFirstAid(true); setEmWagaQhse(''); setEmContractor(''); setMusterPoint(''); setMedicalFacility('')
      setGeneralRisks([]); setActivityRisks([]); setPpe([]); setPermits([]); setTraining([])
      setTasks([{ task: '', hazard: '', control: '' }]); setLotoTypes([])
      setWeather(''); setReviewedWithCrew(true); setCrew('')
      setSupervisorName(''); setSupervisorSign(''); setContractorLead(''); setContractorSign('')
      setEndOfWork({}); setSafetyNotes('')
    }
  }

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const editTask = (i, patch) => setTasks(tasks.map((t, n) => (n === i ? { ...t, ...patch } : t)))
  const valid = workDescription.trim() && location.trim() && tasks.some((t) => t.task.trim())

  const nextId = () => `JSA-${String(existing.length + 1).padStart(3, '0')}`

  return (
    <Modal open={open} onClose={onClose} title="Pre-task safety assessment" subtitle="A digital trial workflow mapped from the WAGA Safety Checklist — complete before work starts" width={760}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={!valid}
            onClick={() => onSave({
              jsaId: nextId(), date, startTime, endTime, siteId,
              location: location.trim(), workDescription: workDescription.trim(),
              contractorCompany: contractorCompany.trim(), contractorSupervisor: contractorSupervisor.trim(), wagaContact: wagaContact.trim(),
              firstAid,
              emergency: {
                wagaQhse: emWagaQhse.trim(), contractor: emContractor.trim(),
                muster: musterPoint.trim(), medical: medicalFacility.trim(),
              },
              generalRisks, activityRisks, ppe, permits, training,
              tasks: tasks.filter((t) => t.task.trim()).map((t) => ({ task: t.task.trim(), hazard: t.hazard.trim(), control: t.control.trim() })),
              lotoTypes,
              weather: weather.trim(), reviewedWithCrew,
              crew: crew.split(',').map((c) => c.trim()).filter(Boolean),
              authorisation: {
                supervisorName: supervisorName.trim(), supervisorSign: supervisorSign.trim(),
                contractorLead: contractorLead.trim(), contractorSign: contractorSign.trim(),
              },
              endOfWork, safetyNotes: safetyNotes.trim(),
              status: 'Submitted', submittedBy: USER.name,
            })}>
            Submit assessment
          </ActionButton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FieldGroup title="General information">
          <Field label="Description of work activity" required>
            <textarea rows={2} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)}
              placeholder="What the crew is about to do." style={{ ...input, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Field label="Site" required>
              <select value={siteId} onChange={(e) => {
                // The location follows the site unless it has been typed over,
                // so the common case needs no second entry and the unusual one
                // — a yard, a gate, a specific vessel — is still sayable.
                const next = e.target.value
                if (location === siteNameOf(siteId)) setLocation(siteNameOf(next))
                setSiteId(next)
              }} style={input}>
                {siteList.map((s) => <option key={s.siteId} value={s.siteId}>{s.code} — {s.siteName}</option>)}
              </select>
            </Field>
            <Field label="Location" required>
              <input value={location} onChange={(e) => setLocation(e.target.value)} style={input} />
            </Field>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
            </Field>
            <Field label="First aid onsite">
              <select value={firstAid ? 'Yes' : 'No'} onChange={(e) => setFirstAid(e.target.value === 'Yes')} style={input}>
                <option>Yes</option><option>No</option>
              </select>
            </Field>
            <Field label="Start time">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={input} />
            </Field>
            <Field label="End time">
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={input} />
            </Field>
            <Field label="WAGA contact">
              <input value={wagaContact} onChange={(e) => setWagaContact(e.target.value)} placeholder="WAGA representative on site" style={input} />
            </Field>
            <Field label="Contractor company">
              <input value={contractorCompany} onChange={(e) => setContractorCompany(e.target.value)} placeholder="Company performing the work" style={input} />
            </Field>
            <Field label="Contractor supervisor">
              <input value={contractorSupervisor} onChange={(e) => setContractorSupervisor(e.target.value)} placeholder="On-site supervisor" style={input} />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup title="Emergency information">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="WAGA / QHSE emergency contact">
              <input value={emWagaQhse} onChange={(e) => setEmWagaQhse(e.target.value)} placeholder="Name / phone" style={input} />
            </Field>
            <Field label="Contractor emergency contact">
              <input value={emContractor} onChange={(e) => setEmContractor(e.target.value)} placeholder="Name / phone" style={input} />
            </Field>
            <Field label="Muster point">
              <input value={musterPoint} onChange={(e) => setMusterPoint(e.target.value)} placeholder="Assembly point on site" style={input} />
            </Field>
            <Field label="Nearest medical facility">
              <input value={medicalFacility} onChange={(e) => setMedicalFacility(e.target.value)} placeholder="Hospital / clinic and distance" style={input} />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup title="Risk assessment">
          <Chips label="General risks" options={GENERAL_RISKS} selected={generalRisks} onToggle={(v) => toggle(generalRisks, setGeneralRisks, v)} />
          <Chips label="Activity-specific risks" options={ACTIVITY_RISKS} selected={activityRisks} onToggle={(v) => toggle(activityRisks, setActivityRisks, v)} />
        </FieldGroup>

        <FieldGroup title="PPE" hint="The personal protective equipment required for this task.">
          <Chips label="Required PPE" options={PPE_OPTIONS} selected={ppe} onToggle={(v) => toggle(ppe, setPpe, v)} />
        </FieldGroup>

        <FieldGroup title="Protection">
          <Chips label="Required permits" options={PERMITS} selected={permits} onToggle={(v) => toggle(permits, setPermits, v)} />
          <Chips label="Required training" options={REQUIRED_TRAINING} selected={training} onToggle={(v) => toggle(training, setTraining, v)} />
        </FieldGroup>

        <FieldGroup title="Task hazard analysis" hint="One row per job step — the step, the exposure it creates, and the control that answers it.">
          {tasks.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <input value={t.task} onChange={(e) => editTask(i, { task: e.target.value })} placeholder="Task step" style={input} />
              <input value={t.hazard} onChange={(e) => editTask(i, { hazard: e.target.value })} placeholder="Hazard" style={input} />
              <input value={t.control} onChange={(e) => editTask(i, { control: e.target.value })} placeholder="Control" style={input} />
              <button type="button" onClick={() => setTasks(tasks.length > 1 ? tasks.filter((_, n) => n !== i) : tasks)}
                style={rm} aria-label="Remove row">×</button>
            </div>
          ))}
          <button type="button" onClick={() => setTasks([...tasks, { task: '', hazard: '', control: '' }])} style={addBtn}>+ Add row</button>
        </FieldGroup>

        <FieldGroup title="LOTO (if applicable)">
          <Chips label="Type of isolation" options={LOTO_TYPES} selected={lotoTypes} onToggle={(v) => toggle(lotoTypes, setLotoTypes, v)} />
        </FieldGroup>

        <FieldGroup title="Work authorisation">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Weather impact on the task">
              <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="e.g. High wind — MEWP work paused" style={input} />
            </Field>
            <Field label="Checklist reviewed with crew">
              <select value={reviewedWithCrew ? 'Yes' : 'No'} onChange={(e) => setReviewedWithCrew(e.target.value === 'Yes')} style={input}>
                <option>Yes</option><option>No</option>
              </select>
            </Field>
          </div>
          <Field label="Crew acknowledgement" hint="Names of the crew acknowledging this assessment, comma-separated.">
            <input value={crew} onChange={(e) => setCrew(e.target.value)} placeholder="e.g. J. Rengers, C. Houseknecht" style={input} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Supervisor name">
              <input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} style={input} />
            </Field>
            <Field label="Supervisor signature" hint="Type full name to sign.">
              <input value={supervisorSign} onChange={(e) => setSupervisorSign(e.target.value)} placeholder="Signed" style={{ ...input, fontStyle: supervisorSign ? 'italic' : 'normal' }} />
            </Field>
            <Field label="Contractor lead name">
              <input value={contractorLead} onChange={(e) => setContractorLead(e.target.value)} style={input} />
            </Field>
            <Field label="Contractor lead signature" hint="Type full name to sign.">
              <input value={contractorSign} onChange={(e) => setContractorSign(e.target.value)} placeholder="Signed" style={{ ...input, fontStyle: contractorSign ? 'italic' : 'normal' }} />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup title="End-of-work review" hint="Completed as the crew leaves — each item Yes, No or not applicable.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
            {END_OF_WORK.map((item) => (
              <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#334155' }}>
                <span style={{ flex: 1, minWidth: 0 }}>{item}</span>
                <select value={endOfWork[item] || ''} onChange={(e) => setEndOfWork({ ...endOfWork, [item]: e.target.value })}
                  style={{ ...input, width: 90, padding: '6px 8px' }}>
                  <option value="">—</option>
                  {YES_NO_NA.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            ))}
          </div>
          <Field label="Additional safety notes">
            <textarea rows={2} value={safetyNotes} onChange={(e) => setSafetyNotes(e.target.value)}
              placeholder="Anything worth recording as the work closes out." style={{ ...input, resize: 'vertical' }} />
          </Field>
        </FieldGroup>
      </div>
    </Modal>
  )
}

/** A submitted JSA, read back. */
function JsaView({ jsa, onClose }) {
  if (!jsa) return null
  const em = jsa.emergency || {}
  const auth = jsa.authorisation || {}
  const eow = jsa.endOfWork || {}
  const eowRows = Object.entries(eow).filter(([, v]) => v)
  const timeRange = [jsa.startTime, jsa.endTime].filter(Boolean).join(' – ')
  const training = Array.isArray(jsa.training) ? jsa.training : (jsa.training ? [jsa.training] : [])

  return (
    <Modal open={Boolean(jsa)} onClose={onClose} title={jsa.workDescription} subtitle={`${jsa.jsaId} · ${jsa.location} · ${fmtDate(jsa.date)}`} width={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={groupTitle}>General information</div>
        {timeRange ? <Line k="Time on site" v={timeRange} /> : null}
        {jsa.wagaContact ? <Line k="WAGA contact" v={jsa.wagaContact} /> : null}
        {jsa.contractorCompany ? <Line k="Contractor" v={jsa.contractorSupervisor ? `${jsa.contractorCompany} · ${jsa.contractorSupervisor}` : jsa.contractorCompany} /> : null}
        <Line k="First aid onsite" v={jsa.firstAid ? 'Yes' : 'No'} />

        {(em.wagaQhse || em.contractor || em.muster || em.medical) && (
          <div>
            <div style={groupTitle}>Emergency information</div>
            {em.wagaQhse ? <Line k="WAGA / QHSE contact" v={em.wagaQhse} /> : null}
            {em.contractor ? <Line k="Contractor contact" v={em.contractor} /> : null}
            {em.muster ? <Line k="Muster point" v={em.muster} /> : null}
            {em.medical ? <Line k="Nearest medical" v={em.medical} /> : null}
          </div>
        )}

        {jsa.generalRisks?.length ? <TagLine k="General risks" items={jsa.generalRisks} /> : null}
        {jsa.activityRisks?.length ? <TagLine k="Activity risks" items={jsa.activityRisks} /> : null}
        {jsa.ppe?.length ? <TagLine k="PPE" items={jsa.ppe} tone="green" /> : null}
        {jsa.permits?.length ? <TagLine k="Permits" items={jsa.permits} tone="amber" /> : null}
        {training.length ? <TagLine k="Training" items={training} /> : null}
        {jsa.lotoTypes?.length ? <TagLine k="LOTO" items={jsa.lotoTypes} /> : null}

        {(jsa.tasks || []).length > 0 && (
          <div>
            <div style={groupTitle}>Task hazard analysis</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 560 }}>
                <thead><tr style={{ background: '#f8fafc' }}><th style={th}>#</th><th style={th}>Task</th><th style={th}>Hazard</th><th style={th}>Control</th></tr></thead>
                <tbody>
                  {jsa.tasks.map((t, n) => (
                    <tr key={n} style={{ borderBottom: '1px solid #eef1f6' }}>
                      <td style={{ ...td, width: 34, color: '#94a3b8', fontWeight: 700 }}>{n + 1}</td>
                      <td style={td}>{t.task}</td><td style={td}>{t.hazard || '—'}</td><td style={td}>{t.control || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <div style={groupTitle}>Work authorisation</div>
          {jsa.weather ? <Line k="Weather impact" v={jsa.weather} /> : null}
          <Line k="Reviewed with crew" v={jsa.reviewedWithCrew === false ? 'No' : 'Yes'} />
          {jsa.crew?.length ? <TagLine k="Crew acknowledgement" items={jsa.crew} tone="green" /> : null}
          {auth.supervisorName || auth.supervisorSign ? <Line k="Supervisor" v={sig(auth.supervisorName, auth.supervisorSign)} /> : null}
          {auth.contractorLead || auth.contractorSign ? <Line k="Contractor lead" v={sig(auth.contractorLead, auth.contractorSign)} /> : null}
        </div>

        {(eowRows.length || jsa.safetyNotes) && (
          <div>
            <div style={groupTitle}>End-of-work review</div>
            {eowRows.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: jsa.safetyNotes ? 10 : 0 }}>
                {eowRows.map(([k, v]) => (
                  <span key={k} style={{ ...chip, background: v === 'Yes' ? '#ecfdf5' : v === 'No' ? '#fef2f2' : '#f1f5f9', borderColor: v === 'Yes' ? '#a7f3d0' : v === 'No' ? '#fecaca' : '#e2e8f0', color: v === 'Yes' ? '#047857' : v === 'No' ? '#b91c1c' : '#475569' }}>
                    {k}: {v}
                  </span>
                ))}
              </div>
            ) : null}
            {jsa.safetyNotes ? <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55 }}>{jsa.safetyNotes}</div> : null}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#94a3b8' }}>Submitted by {jsa.submittedBy}</div>
      </div>
    </Modal>
  )
}

/** A name with its typed signature, read back as "Name (signed: X)". */
function sig(name, signed) {
  if (name && signed) return `${name} — signed: ${signed}`
  return name || signed || '—'
}

function Chips({ label, options, selected, onToggle }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {options.map((o) => {
          const on = selected.includes(o)
          return (
            <button key={o} type="button" onClick={() => onToggle(o)}
              style={{ ...chip, cursor: 'pointer', background: on ? '#eef1ff' : '#f1f5f9', color: on ? '#3640d8' : '#475569', borderColor: on ? '#c7d2fe' : '#e2e8f0', fontWeight: on ? 700 : 600 }}>
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FieldGroup({ title, hint, children }) {
  return (
    <div>
      <div style={groupTitle}>{title}</div>
      {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: -4, marginBottom: 10, lineHeight: 1.45 }}>{hint}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
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

function Line({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12.5 }}>
      <span style={{ color: '#94a3b8', flex: '0 0 150px' }}>{k}</span>
      <span style={{ color: '#0f172a', fontWeight: 600 }}>{v}</span>
    </div>
  )
}

function TagLine({ k, items, tone }) {
  const c = tone === 'amber' ? { bg: '#fffbeb', bd: '#fde68a', fg: '#b45309' }
    : tone === 'green' ? { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#047857' }
      : { bg: '#f1f5f9', bd: '#e2e8f0', fg: '#475569' }
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12.5, alignItems: 'flex-start' }}>
      <span style={{ color: '#94a3b8', flex: '0 0 150px', paddingTop: 3 }}>{k}</span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((it) => <span key={it} style={{ ...chip, background: c.bg, borderColor: c.bd, color: c.fg }}>{it}</span>)}
      </span>
    </div>
  )
}

// ── the schema reference (unchanged, blank) ────────────────────────────────

function SchemaField({ field }) {
  const options = optionList(field)
  const conditional = /conditional/i.test(field.requirement)
  return (
    <div style={{ padding: '13px 15px', border: '1px solid #e4e9f0', borderRadius: 11, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
          {field.label}{!conditional && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
        </div>
        <StatusBadge tone={conditional ? 'grey' : 'blue'}>{TYPE_LABEL[field.fieldType] || field.fieldType}</StatusBadge>
      </div>
      <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>{field.fieldId} · {field.requirement}</div>
      {options.length > 1 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {options.map((o) => <span key={o} style={chip}>{o}</span>)}
        </div>
      ) : field.options ? (
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 9, lineHeight: 1.5 }}>{field.options}</div>
      ) : (
        <div style={{ marginTop: 10 }}><div style={inputStub} /></div>
      )}
    </div>
  )
}

function Matrix({ fields }) {
  const [task, hazard, control] = fields
  return (
    <div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 11, lineHeight: 1.55 }}>
        The supplied form carries ten of these rows. Each names a job step, the exposure it
        creates, and the engineered, administrative or PPE control that answers it.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 620 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>#</th><th style={th}>{task?.label || 'Specific Task'}</th>
              <th style={th}>{hazard?.label || 'Specific Hazard'}</th><th style={th}>{control?.label || 'Control Method'}</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((n) => (
              <tr key={n} style={{ borderBottom: '1px solid #eef1f6' }}>
                <td style={{ ...td, width: 40, color: '#94a3b8', fontWeight: 700 }}>{n}</td>
                <td style={td}><div style={inputStub} /></td><td style={td}><div style={inputStub} /></td><td style={td}><div style={inputStub} /></td>
              </tr>
            ))}
            <tr><td colSpan={4} style={{ ...td, color: '#94a3b8', fontSize: 11.5, fontStyle: 'italic' }}>Rows 4–10 continue the same structure.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const card = {
  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
  padding: '13px 15px', border: '1px solid #e4e9f0', borderRadius: 11, background: '#fff',
}
const groupTitle = { fontSize: 12.5, fontWeight: 700, color: '#15227a', marginBottom: 10 }
const chip = {
  padding: '3px 9px', borderRadius: 999, background: '#f1f5f9',
  border: '1px solid #e2e8f0', color: '#475569', fontSize: 11, fontWeight: 600,
}
const miniChip = {
  padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0',
  color: '#64748b', fontSize: 10.5, fontWeight: 700,
}
const inputStub = { height: 30, borderRadius: 8, background: '#f8fafc', border: '1px dashed #dbe1ea' }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0f172a', background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
const addBtn = {
  alignSelf: 'flex-start', padding: '7px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
  color: '#3640d8', background: '#eef1ff', border: '1px solid #dbe2ff', borderRadius: 9, cursor: 'pointer',
}
const rm = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid #fecaca', background: '#fff',
  color: '#b91c1c', fontSize: 16, cursor: 'pointer', lineHeight: 1,
}
const th = { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid #e4e9f0' }
const td = { padding: '9px 12px', verticalAlign: 'middle' }
