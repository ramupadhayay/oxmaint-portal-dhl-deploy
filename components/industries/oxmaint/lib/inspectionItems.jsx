'use client'

// What an inspection is made of, and the runner that completes one.
//
// Two screens run inspections — the report list looking backwards and the
// reminder list looking forwards — and the worst outcome would be two runners
// that slowly drift apart, so the items, the scoring rule and the follow-up all
// live here and both screens mount the same component.
//
// The other half of this file is the item bank. A CMMS that records "12 items,
// 3 findings" without ever saying which twelve or which three is a reporting
// tool, not an inspection tool: the value of an inspection is the line that
// failed and the note the technician left on it.
//
// The bank asks the round's questions, which are the same on every machine. The
// condition lines in inspectionSheet.js ask the machine's — the readings, their
// limits and the few checks a failure on which is not a note for next month —
// and are appended once the runner knows which asset it is standing in front
// of. The whole answered sheet is kept on the record, so a round can be read
// back line by line rather than as a percentage.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, ActionButton, PALETTE } from './kit'
import { sectionIcon } from './nav'
import { useActions } from './actions'
import { ASSETS, TECHNICIANS, INSPECTIONS, USER, INSPECTION_TYPE_DEFS } from './data'
import {
  assetTypeFor, gradeSheet, inspectionSheet, inspectionTemplate, withinLimit,
} from './inspectionSheet'

const { MUTE, SUB, INK, LINE, ACCENT, GREEN, AMBER, RED } = PALETTE

// ── the items ────────────────────────────────────────────────────────────
const DEFAULT_ITEM_BANK = {
  'Daily walk-round': [
    'Machine guards fitted, undamaged and secure',
    'No oil, coolant or air leaks under the machine',
    'Gearbox oil level within the sight glass',
    'Compressed air pressure inside the marked band',
    'No abnormal noise, knocking or vibration at running speed',
    'Drive belts free of glazing, cracking or slack',
    'Emergency stop head unobstructed and undamaged',
    'Local control panel indicators reading normal',
    'Access and walkways around the machine clear',
    'Swarf, waste and rag bins below the fill line',
    'Bearing housings cool to the hand',
    'Motor cooling cowl clear of debris',
  ],
  'Pre-start check': [
    'Isolation removed and lockout tags cleared',
    'Guards refitted and interlocks proved',
    'Emergency stop function tested and reset',
    'Lubrication points charged before first run',
    'Coolant and hydraulic levels above minimum',
    'Tooling and fixtures secure and correctly torqued',
    'Air supply purged of condensate',
    'Mode selector set to the correct position',
    'Previous shift handover notes read',
    'Trial cycle run at reduced speed without alarm',
  ],
  'Safety inspection': [
    'Fire extinguishers in position, sealed and in date',
    'Escape routes and fire doors unobstructed',
    'Emergency lighting operating on test',
    'First aid kit stocked and in date',
    'Eye wash station sealed, in date and accessible',
    'Spill kit complete and clearly marked',
    'PPE available in the correct sizes at the station',
    'Guard interlocks proved and not defeated',
    'Lockout points labelled and padlocks available',
    'Electrical enclosures closed and secured',
    'Trailing leads and hoses clear of walkways',
    'Chemicals labelled and stored in the right cabinet',
    'Safety data sheets available at the point of use',
    'Lifting accessories marked with SWL and in date',
    'Handrails, edge protection and gratings secure',
    'Permit and risk assessment displayed at the task',
  ],
  'Condition survey': [
    'Vibration readings taken at drive and non-drive end',
    'Bearing temperatures logged against the baseline',
    'Motor current compared with the nameplate rating',
    'Shaft alignment checked and within tolerance',
    'Coupling elements inspected for wear and backlash',
    'Belt tension measured and recorded',
    'Lubricant sample drawn for analysis',
    'Oil condition assessed against the reference sample',
    'Filter differential pressure recorded',
    'Seals and gaskets inspected for weeping',
    'Foundation bolts and mountings checked for tightness',
    'Corrosion and coating condition assessed',
    'Structural welds and brackets inspected for cracking',
    'Running hours read from the meter and recorded',
  ],
}

// A pack that names its own inspection types brings their items, and those
// replace the bank whole. Keeping the generic four alongside would let a ramp
// round fall back to asking about swarf bins.
export const ITEM_BANK = INSPECTION_TYPE_DEFS
  ? Object.fromEntries(INSPECTION_TYPE_DEFS.map((t) => [t.type, t.items]))
  : DEFAULT_ITEM_BANK

const FALLBACK_TYPE = INSPECTION_TYPE_DEFS ? INSPECTION_TYPE_DEFS[0].type : 'Daily walk-round'

const bankFor = (type) => ITEM_BANK[type] || ITEM_BANK[FALLBACK_TYPE]

/**
 * The list, not a count — so an inspection's item count can never disagree with
 * the items it opens onto.
 *
 * A round walked against a known machine also asks that machine's condition
 * lines. They are appended rather than folded into the bank so the checklist
 * stays the checklist: `itemCount` still answers for the type alone, which is
 * what the reminder register and the create screen describe, and the runner
 * says plainly how many lines the asset added on top.
 */
export const itemsFor = (type, key = 'ins', assetType = '') => [
  ...bankFor(type).map((text, i) => ({
    id: `${key}_i${i + 1}`, text, type: 'pass', responseType: 'Pass / fail', group: 'Checklist',
  })),
  ...(assetType ? inspectionTemplate(assetType, key) : []),
]

export const itemCount = (type) => bankFor(type).length

/**
 * The sheet behind a record, and how far it can be believed.
 *
 * Three states, and the difference matters enough to return it rather than let
 * each screen guess. A round this portal ran carries the technician's own
 * answers. A round still to be walked can only show the lines it is going to
 * ask. A seeded report has neither — it has a result, a score and a count of
 * findings — so its lines are rebuilt from those and have to be labelled as
 * rebuilt wherever they are shown, because a reconstruction presented as a
 * signature is the one thing an inspection register must never do.
 */
export function sheetFor(record) {
  if (!record) return { lines: [], state: 'planned' }
  const signed = Array.isArray(record.sheet) ? record.sheet : []
  if (signed.length) return { lines: signed, state: 'signed' }
  const lines = itemsFor(record.inspection_type, record.inspection_number || 'ins', assetTypeFor(record))
  if (record.status !== 'Completed') return { lines, state: 'planned' }
  return { lines: inspectionSheet(record, lines), state: 'reconstructed' }
}

/**
 * What a set of findings is worth as a work order.
 *
 * Read off the whole inspection rather than the single line: two failures found
 * on one machine in one visit is a different conversation from one, and so is a
 * single failure on a line the sheet marks critical — a brake that did not hold
 * or an interlock that did not prove is not a job for next Tuesday. Shared so
 * the number quoted to the technician before they raise the work is the number
 * the work is actually raised at.
 */
export const priorityOf = (findings = []) =>
  (findings.length >= 2 || findings.some((f) => f.critical) ? 'Critical' : 'High')

export const FREQUENCY_DAYS = {
  Daily: 1, Weekly: 7, Fortnightly: 14, Monthly: 30, Quarterly: 91, 'Six-monthly': 182, Annual: 365,
}

// A reminder that arrives with only a type still needs an interval, and taking
// it from the type keeps a walk-round daily and a condition survey quarterly
// rather than putting everything on the same cadence.
export const frequencyFor = (type) => ((INSPECTION_TYPE_DEFS
  ? Object.fromEntries(INSPECTION_TYPE_DEFS.map((t) => [t.type, t.frequency]))
  : {
    'Daily walk-round': 'Daily',
    'Pre-start check': 'Daily',
    'Safety inspection': 'Monthly',
    'Condition survey': 'Quarterly',
  })[type] || 'Monthly')

/** Continues the seeded INS-1400..1439 sequence rather than restarting it. */
export const nextInspectionNumber = (stored = []) => {
  const highest = [...stored, ...INSPECTIONS].reduce((max, i) => {
    const n = Number(String(i.inspection_number || '').replace(/\D/g, ''))
    return Number.isFinite(n) && n > max ? n : max
  }, 1439)
  return `INS-${highest + 1}`
}

const ANSWERS = [['pass', 'Pass', GREEN], ['fail', 'Fail', RED], ['na', 'N/A', '#94a3b8']]

/**
 * Run an inspection.
 *
 * `subject` describes what is being inspected — key, reference, inspection_type,
 * asset_id, asset_name, inspector_name, and an optional label for the header.
 * `onSubmit(summary)` is where each screen writes its own record, and whatever
 * reference it returns is what the corrective work orders are stamped with —
 * a reminder has no inspection number until the run creates one.
 */
export function InspectionRunner({ open, onClose, subject, onSubmit }) {
  const { raiseWorkOrder } = useActions()

  // raiseWorkOrder reads the work orders it can see to choose the next number.
  // Raising three findings from one captured copy would give all three the same
  // number, so each pass through the loop takes the newest one instead.
  const raiseRef = useRef(raiseWorkOrder)
  useEffect(() => { raiseRef.current = raiseWorkOrder })

  const [phase, setPhase] = useState('run')
  const [answers, setAnswers] = useState({})
  const [notes, setNotes] = useState({})
  const [readings, setReadings] = useState({})
  const [assetId, setAssetId] = useState('')
  const [inspector, setInspector] = useState('')
  const [note, setNote] = useState('')
  const [startedAt, setStartedAt] = useState(0)
  const [summary, setSummary] = useState(null)
  const [chosen, setChosen] = useState([])
  const [raised, setRaised] = useState([])

  const key = subject?.key || ''
  const type = subject?.inspection_type || FALLBACK_TYPE

  // A run belongs to one subject: opening the drawer on the next asset must not
  // inherit the last one's answers, and resetting in an effect would show them
  // for a frame first.
  const runKey = `${key}-${open}`
  const [seenKey, setSeenKey] = useState(runKey)
  if (runKey !== seenKey) {
    setSeenKey(runKey)
    setPhase('run')
    setAnswers({})
    setNotes({})
    setReadings({})
    setNote('')
    setSummary(null)
    setChosen([])
    setRaised([])
    setAssetId(subject?.asset_id || '')
    setInspector(subject?.inspector_name || USER.name)
    setStartedAt(Date.now())
  }

  // The condition lines follow the asset picker rather than the round, because
  // what is worth measuring is a property of the machine. Changing the asset
  // mid-run therefore changes the tail of the sheet; their ids carry the plant
  // bucket, so an answer given about a pump can never be inherited by a chiller
  // standing in the same position on the list.
  const asset = ASSETS.find((a) => a.asset_id === assetId)
  const items = useMemo(() => itemsFor(type, key, asset?.asset_type), [type, key, asset?.asset_type])
  const bankItems = itemCount(type)
  const conditionItems = Math.max(0, items.length - bankItems)
  // A single heading over a single group is noise, so they only appear once the
  // sheet actually has two halves.
  const grouped = conditionItems > 0

  const answered = items.filter((i) => answers[i.id]).length
  const failedItems = items.filter((i) => answers[i.id] === 'fail')
  const progress = items.length ? Math.round((answered / items.length) * 100) : 0

  const setAnswer = (id, val) => setAnswers((p) => ({ ...p, [id]: val }))
  const setReading = (id, val) => setReadings((p) => ({ ...p, [id]: val }))

  const passRemaining = () => setAnswers((p) => {
    const next = { ...p }
    items.forEach((i) => { if (!next[i.id]) next[i.id] = 'pass' })
    return next
  })

  const submit = async () => {
    // The answered sheet, kept whole and written onto the record. A row that
    // stores only "12 items, 3 findings" cannot be read back a month later, and
    // the reading beside its limit is the half of an inspection that earns the
    // trend on the next one.
    const sheet = items.map((i) => {
      // Half-typed readings — a lone dot or minus — are not measurements, and
      // storing them as NaN would put a reading on the record that no limit can
      // ever be checked against.
      const typed = Number(String(readings[i.id] ?? '').trim())
      const taken = String(readings[i.id] ?? '').trim() !== '' && Number.isFinite(typed)
      return {
        id: i.id,
        text: i.text,
        type: i.type || 'pass',
        unit: i.unit || '',
        limit: i.limit || '',
        critical: Boolean(i.critical),
        responseType: i.responseType || 'Pass / fail',
        group: i.group || '',
        response: answers[i.id] || 'na',
        reading: taken ? typed : null,
        value: taken ? `${typed}${i.unit ? ` ${i.unit}` : ''}` : null,
        note: (notes[i.id] || '').trim() || null,
      }
    })
    const answeredLine = new Map(sheet.map((l) => [l.id, l]))
    const findings = failedItems.map((i) => ({
      text: i.text,
      note: (notes[i.id] || '').trim(),
      reading: answeredLine.get(i.id)?.value || null,
      limit: i.limit || '',
      critical: Boolean(i.critical),
    }))
    const s = {
      // Graded by the shared rule rather than a second copy of it here, so the
      // score on a live run and the score under a rebuilt sheet cannot drift.
      ...gradeSheet(sheet, note),
      findings_count: findings.length,
      findings,
      sheet,
      note: note.trim(),
      asset_id: assetId,
      asset_name: asset?.asset_name || subject?.asset_name || '—',
      asset_code: asset?.asset_code || '',
      asset_type: asset?.asset_type || '',
      site_id: asset?.site_id || '',
      site_name: asset?.site_name || '',
      inspector_name: inspector,
      duration_minutes: Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
    }

    const reference = (await onSubmit?.(s)) || subject?.reference || ''
    setSummary({ ...s, reference })

    if (!findings.length) {
      onClose?.()
      return
    }
    setChosen(findings.map((_, i) => i))
    setPhase('findings')
  }

  const raiseAll = async () => {
    const picks = summary.findings.filter((_, i) => chosen.includes(i))
    if (!picks.length) { onClose?.(); return }

    const priority = priorityOf(summary.findings)
    const numbers = []
    for (const f of picks) {
      // Sequential on purpose — see the numbering note on raiseRef.
      // eslint-disable-next-line no-await-in-loop
      const wo = await raiseRef.current({
        title: f.text,
        description: `${type} ${summary.reference} on ${summary.asset_name} recorded this as failed.`
          // The measurement goes into the work order, not just onto the report.
          // A fitter reading "vibration high" plans a different visit from one
          // reading 7.2 mm/s against a limit of 4.5.
          + (f.reading ? ` Recorded ${f.reading}${f.limit ? ` against limit ${f.limit}` : ''}.` : '')
          + (f.note ? ` Inspector note: ${f.note}` : '')
          + (summary.note ? ` Inspection note: ${summary.note}` : ''),
        assetId: summary.asset_id,
        type: 'Corrective',
        priority,
        dueInDays: priority === 'Critical' ? 2 : 5,
        estimatedHours: 2,
        source: `Inspection ${summary.reference}`,
      })
      if (wo?.work_order_number) numbers.push({ number: wo.work_order_number, text: f.text })
    }
    setRaised(numbers)
    setPhase('done')
  }

  const footer = phase === 'run' ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: answered === items.length ? GREEN : MUTE }}>
        {answered} of {items.length} answered{failedItems.length ? ` · ${failedItems.length} failed` : ''}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
        <ActionButton variant={failedItems.length ? 'danger' : 'success'} disabled={answered < items.length} onClick={submit}>
          {answered < items.length
            ? `${items.length - answered} left`
            : failedItems.length ? `Submit — ${failedItems.length} failed` : 'Submit — all pass'}
        </ActionButton>
      </div>
    </div>
  ) : phase === 'findings' ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: chosen.length ? RED : MUTE }}>
        {chosen.length} of {summary.findings.length} selected
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <ActionButton variant="ghost" onClick={onClose}>Not now</ActionButton>
        <ActionButton variant="danger" disabled={!chosen.length} onClick={raiseAll}>
          Raise {chosen.length} work order{chosen.length === 1 ? '' : 's'}
        </ActionButton>
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <ActionButton onClick={onClose}>Done</ActionButton>
    </div>
  )

  return (
    <Drawer
      open={Boolean(open && subject)}
      onClose={onClose}
      title={phase === 'run' ? (subject?.label || subject?.reference || type) : phase === 'findings' ? 'Findings' : 'Follow-up raised'}
      subtitle={phase === 'run'
        ? `${type} · ${bankItems} checklist items${conditionItems ? ` + ${conditionItems} condition lines` : ''}`
        : `${summary?.reference || subject?.reference || type} · ${summary?.asset_name}`}
      icon={sectionIcon('inspections', ACCENT)}
      width={560}
      footer={footer}
    >
      {phase === 'run' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, marginBottom: 5 }}>
              <span style={{ color: SUB, fontWeight: 600 }}>Progress</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {answered < items.length && (
                  <button onClick={passRemaining} style={linkBtn}>Pass remaining</button>
                )}
                <span style={{ fontWeight: 800, color: progress === 100 ? GREEN : AMBER }}>{progress}%</span>
              </span>
            </div>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? GREEN : AMBER, transition: 'width .2s' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
            <div>
              <label style={miniLabel}>Asset</label>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} style={miniSelect}>
                <option value="">Not asset-specific</option>
                {ASSETS.map((a) => <option key={a.asset_id} value={a.asset_id}>{a.asset_name} — {a.asset_code}</option>)}
              </select>
            </div>
            <div>
              <label style={miniLabel}>Inspector</label>
              <select value={inspector} onChange={(e) => setInspector(e.target.value)} style={miniSelect}>
                {TECHNICIANS.map((t) => <option key={t.user_id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            {items.map((item, i) => {
              const head = grouped && item.group && item.group !== items[i - 1]?.group ? item.group : null
              // Judged, not enforced. The technician still says whether the line
              // passed — a reading over its limit on a machine that is being run
              // down to a shutdown is a known condition, not a wrong answer.
              const within = item.type === 'reading' ? withinLimit(item.limit, readings[item.id]) : null
              return (
                <div key={item.id}>
                  {head && <div style={groupHead}>{head}</div>}
                  <div style={{ padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10.5, color: MUTE, fontWeight: 700, minWidth: 18 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, lineHeight: 1.45 }}>
                        {item.text}
                        {item.critical && <span style={criticalDot} title="Critical line — a failure here is not a note for next month" />}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {ANSWERS.map(([val, text, color]) => (
                          <button key={val} onClick={() => setAnswer(item.id, val)}
                            style={{
                              padding: '4px 9px', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                              borderRadius: 7, border: `1px solid ${answers[item.id] === val ? color : LINE}`,
                              background: answers[item.id] === val ? color : '#fff',
                              color: answers[item.id] === val ? '#fff' : SUB,
                            }}>{text}</button>
                        ))}
                      </div>
                    </div>
                    {item.type === 'reading' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, paddingLeft: 28 }}>
                        <input
                          inputMode="decimal"
                          value={readings[item.id] ?? ''}
                          onChange={(e) => setReading(item.id, e.target.value.replace(/[^\d.-]/g, ''))}
                          placeholder="Reading"
                          style={readingInput}
                        />
                        <span style={{ fontSize: 11.5, color: SUB, fontWeight: 600 }}>{item.unit}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: within === false ? RED : MUTE }}>
                          limit {item.limit}{within === false ? ' · outside' : ''}
                        </span>
                      </div>
                    )}
                    {answers[item.id] === 'fail' && (
                      <input
                        value={notes[item.id] || ''}
                        onChange={(e) => setNotes((p) => ({ ...p, [item.id]: e.target.value }))}
                        placeholder="What is wrong with it? This becomes the work order."
                        style={{
                          width: '100%', boxSizing: 'border-box', marginTop: 7, padding: '7px 10px', fontSize: 12,
                          border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#7f1d1d',
                          fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div>
            <label style={miniLabel}>Inspection notes</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={failedItems.length ? 'Anything the corrective work should know' : 'Observations worth recording'}
              style={{ ...miniSelect, resize: 'vertical', fontWeight: 400, color: INK, cursor: 'text' }} />
          </div>

          {failedItems.length > 0 && (
            <p style={{ margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              {failedItems.length} item{failedItems.length > 1 ? 's' : ''} failed. Submitting records the failure against
              {asset ? ` ${asset.asset_name}` : ' the site'} and offers the corrective work orders next.
            </p>
          )}
        </div>
      )}

      {phase === 'findings' && summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
            {summary.reference} scored {summary.score}% — {summary.findings_count} of {summary.items_total} items failed on {summary.asset_name}.
            Each finding you leave ticked becomes a corrective work order,
            priority {priorityOf(summary.findings)}, due in {priorityOf(summary.findings) === 'Critical' ? 2 : 5} days.
          </p>

          <div>
            {summary.findings.map((f, i) => (
              <label key={f.text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: `1px solid ${LINE}`, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={chosen.includes(i)}
                  onChange={() => setChosen((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                  style={{ width: 15, height: 15, marginTop: 2, accentColor: ACCENT, cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, lineHeight: 1.45 }}>
                    {f.text}
                    {f.critical && <span style={criticalDot} title="Critical line" />}
                  </span>
                  {f.reading && (
                    <span style={{ display: 'block', fontSize: 11.5, color: RED, fontWeight: 700, marginTop: 3 }}>
                      {f.reading}{f.limit ? ` · limit ${f.limit}` : ''}
                    </span>
                  )}
                  {f.note && <span style={{ display: 'block', fontSize: 11.5, color: SUB, marginTop: 3 }}>{f.note}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {raised.length ? (
            <>
              <p style={{ margin: 0, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, borderRadius: 9, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}>
                {raised.length} corrective work order{raised.length > 1 ? 's' : ''} raised from {summary.reference}
                {summary.asset_name !== '—' ? ` against ${summary.asset_name}` : ''}. They are open on the Work Orders list, assigned to the least-loaded technician.
              </p>
              <div>
                {raised.map((r) => (
                  <div key={r.number} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '9px 0', borderBottom: `1px solid ${LINE}` }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: ACCENT, minWidth: 76 }}>{r.number}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, lineHeight: 1.45 }}>{r.text}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              No work orders were saved. The findings are recorded on {summary?.reference} and can be raised from there.
            </p>
          )}
        </div>
      )}
    </Drawer>
  )
}

const miniLabel = { display: 'block', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
const miniSelect = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5, fontWeight: 600,
  border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: ACCENT,
  fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}
const linkBtn = {
  background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 11,
  fontWeight: 700, color: ACCENT, cursor: 'pointer', textDecoration: 'underline',
}
const groupHead = {
  fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4,
  padding: '12px 0 4px', borderBottom: `1px solid ${LINE}`,
}
const readingInput = {
  width: 92, boxSizing: 'border-box', padding: '5px 8px', fontSize: 12, fontWeight: 700,
  border: `1px solid ${LINE}`, borderRadius: 7, background: '#fff', color: INK,
  fontFamily: 'inherit', outline: 'none',
}
const criticalDot = {
  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
  background: RED, marginLeft: 6, verticalAlign: 'middle',
}
