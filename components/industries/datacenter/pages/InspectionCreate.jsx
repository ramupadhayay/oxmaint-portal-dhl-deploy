'use client'

// Start New Inspection — the product's create flow, end to end.
//
// Oxmaint's own is a numbered sequence: pick the asset, pick the checklist,
// configure the details, then begin. This follows it, and adds the step that
// makes the rest mean anything — actually working through the checklist. An
// inspection you can create but never complete produces a row with no score, a
// result of "In progress" for ever, and a demo where the interesting screen is
// the one nobody can reach.
//
// It writes through the same records endpoint the work orders use, so what is
// created here survives a refresh and appears at the top of Inspection Reports
// beside the generated rows, badged so the two are never confused.
//
// The checklists offered are the ones whose asset classes include the chosen
// asset — that is the product's behaviour and it is also the honest one: a CRAH
// should not be offered the switchgear round. "Show every checklist" is there
// for the case where somebody wants to run one anyway, which happens.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeading from '../components/PageHeading'
import { ProductStyles, RecordCard, SearchBar, EmptyState, Icons } from '../components/product'
import { StatusBadge, ActionButton, PALETTE } from '../lib/kit'
import { useInspectionStore, useChecklistStore } from '../lib/store'
import { CHECKLISTS, shapeChecklist, nextInspectionNumber, responseOf, wantsReading } from '../lib/inspections'
import { ASSETS_IN_SCOPE, toneOf } from '../lib/data'

const { SUB, MUTE, INK, LINE, ACCENT } = PALETTE

const INSPECTORS = ['D. Reeve', 'T. Whelan', 'S. Kovac', 'M. Bell', 'E. Brandt', 'O. Marsh']
const TEAMS = [
  'Site Engineering',
  'Site Engineering + Electrical Vendor',
  'Mechanical Contractor',
  'Chiller OEM Vendor',
  'Reliability Engineering',
]

const today = () => new Date().toISOString().slice(0, 10)

export default function InspectionCreate() {
  const router = useRouter()
  const { create, created } = useInspectionStore()
  const { created: authored } = useChecklistStore()

  // Checklists written on the Create Checklist screen are offered here beside
  // the library-derived ones. A create flow that cannot see what the authoring
  // flow just produced makes the authoring flow pointless.
  const checklists = useMemo(
    () => [...authored.map(shapeChecklist), ...CHECKLISTS], [authored])

  const [asset, setAsset] = useState(null)
  const [checklist, setChecklist] = useState(null)
  const seeded = useRef(false)

  // Opened from a checklist's own page with that checklist already chosen.
  // Read after the first paint rather than in an initialiser, because the
  // first render also happens on the server, where sessionStorage does not
  // exist and a different tree would be a hydration mismatch. Consumed on
  // read, so a later visit to this screen starts blank.
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    try {
      const raw = window.sessionStorage.getItem('datacenter_inspection_seed')
      if (!raw) return
      window.sessionStorage.removeItem('datacenter_inspection_seed')
      const { checklistId, assetId } = JSON.parse(raw)
      const hit = checklists.find((c) => c.checklistId === checklistId)
      if (hit) setChecklist(hit)
      // Opened from the AI Auditor with an asset to inspect — preselect it so
      // the operator lands on the checklist step, not the asset picker.
      const a = assetId && ASSETS_IN_SCOPE.find((x) => x.assetId === assetId)
      if (a) setAsset(a)
    } catch { /* a malformed seed is no seed */ }
  }, [checklists])
  const [details, setDetails] = useState({
    date: today(), inspector: INSPECTORS[0], team: TEAMS[0], notes: '',
  })
  const [answers, setAnswers] = useState({})
  const [conducting, setConducting] = useState(false)
  const [saving, setSaving] = useState(false)

  const back = () => router.push('/portal/datacenter/inspection-reports')

  // ── step 4: working through the sheet ──────────────────────────────────
  if (conducting && asset && checklist) {
    return (
      <Conduct
        asset={asset} checklist={checklist} details={details}
        answers={answers} setAnswers={setAnswers}
        saving={saving}
        onBack={() => setConducting(false)}
        onComplete={async (status) => {
          setSaving(true)
          const record = {
            reportId: nextInspectionNumber(created),
            assetId: asset.assetId,
            checklistId: checklist.checklistId,
            // Carried so a run against a checklist written in the portal names
            // it. The report shaper resolves the id against the generated
            // library, which an authored checklist is not in — without this it
            // reads as "Ad-hoc inspection".
            task: checklist.name,
            date: details.date,
            inspector: details.inspector,
            team: details.team,
            notes: details.notes.trim() || null,
            status,
            items: checklist.items.map((i) => ({
              itemId: i.itemId,
              text: i.text,
              assetClass: i.assetClass || i.section || null,
              critical: i.critical,
              response: answers[i.itemId]?.response || null,
              // The type the line was answered under, so the report renders a
              // reading as a reading rather than inferring it from the value.
              // Read through responseOf, because the generated library and the
              // builder name this differently and a run has to store one of
              // them, not whichever the checklist happened to carry.
              responseType: responseOf(i),
              value: answers[i.itemId]?.value || null,
              note: answers[i.itemId]?.note || null,
            })),
          }
          const saved = await create(record)
          setSaving(false)
          if (saved) router.push(`/portal/datacenter/inspection-reports/${encodeURIComponent(record.reportId)}`)
        }}
      />
    )
  }

  // ── steps 1–3: setting it up ───────────────────────────────────────────
  return (
    <div>
      <ProductStyles />

      <PageHeading
        back={{ label: 'Inspection Reports', onClick: back }}
        title="Start New Inspection"
        subtitle="First select an asset, then choose a checklist, and configure the details to begin."
      />

      <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
        <Step n={1} title="Select asset" done={Boolean(asset)}>
          <AssetPicker value={asset} onChange={(a) => { setAsset(a); setChecklist(null) }} />
        </Step>

        <Step n={2} title="Select inspection checklist" done={Boolean(checklist)}
          hint={!asset ? 'Select an asset first' : null}>
          {asset
            ? <ChecklistPicker asset={asset} value={checklist} onChange={setChecklist} checklists={checklists} />
            : <p style={styles.muted}>The checklists offered depend on the asset, so pick one above first.</p>}
        </Step>

        <Step n={3} title="Inspection details" done={Boolean(asset && checklist)}
          hint={!checklist ? 'Select a checklist first' : null}>
          <Details value={details} onChange={setDetails} disabled={!checklist} />
        </Step>

        <div style={styles.footer}>
          <div style={{ fontSize: 12.5, color: SUB, minWidth: 0 }}>
            {asset && checklist
              ? <>Ready: <strong style={{ color: INK }}>{checklist._itemCount} items</strong> on {asset.assetName}.</>
              : 'Choose an asset and a checklist to begin.'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <ActionButton variant="ghost" onClick={back}>Cancel</ActionButton>
            <ActionButton
              disabled={!asset || !checklist}
              onClick={() => { setAnswers({}); setConducting(true) }}
            >
              Begin inspection
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── step frame ───────────────────────────────────────────────────────────
function Step({ n, title, children, done, hint }) {
  return (
    <RecordCard>
      <div style={{ padding: 18 }}>
        <div style={styles.stepHead}>
          <span style={{ ...styles.stepNum, ...(done ? styles.stepNumDone : null) }}>
            {done ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
            ) : n}
          </span>
          <h2 style={styles.stepTitle}>{title}</h2>
          {hint && <span style={styles.hint}>{hint}</span>}
        </div>
        {children}
      </div>
    </RecordCard>
  )
}

// ── step 1 ───────────────────────────────────────────────────────────────
function AssetPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    const all = ASSETS_IN_SCOPE
    if (!s) return all.slice(0, 40)
    return all.filter((a) => `${a.assetName} ${a.assetId} ${a.assetClass} ${a._site} ${a._location}`.toLowerCase().includes(s)).slice(0, 40)
  }, [q])

  if (value && !open) {
    return (
      <div>
        <div style={styles.picked}>
          <span style={styles.tile}>{Icons.box}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.pickedName}>{value.assetName}</div>
            <div style={styles.pickedMeta}>{value.assetId} · {value.assetClass}</div>
          </div>
          <StatusBadge tone={toneOf(value.criticality)}>{value.criticality}</StatusBadge>
          <button onClick={() => setOpen(true)} style={styles.change}>Change</button>
        </div>

        {/* The product shows the location under the asset, derived rather than
            asked for — the register already knows where this machine is. */}
        <div style={styles.derived}>
          <span style={{ display: 'flex', color: MUTE }}>{Icons.pin}</span>
          <span><strong style={{ color: INK }}>Location:</strong> {value._site} · {value._location}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SearchBar value={q} onChange={setQ} placeholder="Search an asset by name, id, class or location…" />
      <div style={styles.optionList}>
        {matches.map((a) => (
          <button key={a.assetId} onClick={() => { onChange(a); setOpen(false); setQ('') }} style={styles.option}>
            <span style={{ ...styles.code, width: 148, flexShrink: 0, textAlign: 'left' }}>{a.assetId}</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 13, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.assetName}
            </span>
            <StatusBadge tone={toneOf(a.criticality)}>{a.criticality}</StatusBadge>
            <span style={{ fontSize: 11.5, color: MUTE, flexShrink: 0 }}>{a._site}</span>
          </button>
        ))}
        {!matches.length && <div style={{ ...styles.muted, padding: 14 }}>No asset matches that search.</div>}
      </div>
      {ASSETS_IN_SCOPE.length > matches.length && !q.trim() && (
        <p style={styles.muted}>Showing the first {matches.length} of {ASSETS_IN_SCOPE.length} in-scope assets — search to narrow.</p>
      )}
    </div>
  )
}

// ── step 2 ───────────────────────────────────────────────────────────────
function ChecklistPicker({ asset, value, onChange, checklists }) {
  const [all, setAll] = useState(false)

  const suited = checklists.filter((c) => c.classes.includes(asset.assetClass))
  const list = all || !suited.length ? checklists : suited

  return (
    <div>
      <div style={styles.pickerHead}>
        <span style={{ fontSize: 12.5, color: SUB }}>
          {suited.length
            ? `${suited.length} checklist${suited.length === 1 ? '' : 's'} cover this asset class.`
            : 'No checklist names this asset class, so all are offered.'}
        </span>
        {Boolean(suited.length) && (
          <label style={styles.switch}>
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Show every checklist
          </label>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {list.map((c) => {
          const on = value?.checklistId === c.checklistId
          const fits = c.classes.includes(asset.assetClass)
          return (
            <button key={c.checklistId} onClick={() => onChange(c)}
              style={{ ...styles.checkOption, ...(on ? styles.checkOptionOn : null) }}>
              <span style={{ ...styles.radio, ...(on ? styles.radioOn : null) }} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: MUTE, marginTop: 3 }}>
                  {c.checklistId} · {c._itemCount} items · {c._criticalCount} on critical classes
                </div>
              </div>
              {c._created && <StatusBadge tone="blue">Written here</StatusBadge>}
              {!fits && <StatusBadge tone="amber">Different asset class</StatusBadge>}
              <StatusBadge tone="grey">{c.category}</StatusBadge>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── step 3 ───────────────────────────────────────────────────────────────
function Details({ value, onChange, disabled }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  return (
    <div style={{ ...styles.fields, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <Field label="Inspection date">
        <input type="date" value={value.date} onChange={set('date')} style={styles.input} />
      </Field>
      <Field label="Inspector">
        <select value={value.inspector} onChange={set('inspector')} style={styles.input}>
          {INSPECTORS.map((i) => <option key={i}>{i}</option>)}
        </select>
      </Field>
      <Field label="Team">
        <select value={value.team} onChange={set('team')} style={styles.input}>
          {TEAMS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Notes" wide>
        <textarea value={value.notes} onChange={set('notes')} rows={2}
          placeholder="Anything the inspector should know before starting — access, isolation, a previous finding."
          style={{ ...styles.input, height: 'auto', padding: '9px 11px', resize: 'vertical', lineHeight: 1.5 }} />
      </Field>
    </div>
  )
}

function Field({ label, children, wide }) {
  return (
    <label style={{ display: 'block', minWidth: 0, gridColumn: wide ? '1 / -1' : 'auto' }}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

// ── step 4: the sheet itself ─────────────────────────────────────────────
function Conduct({ asset, checklist, details, answers, setAnswers, onBack, onComplete, saving }) {
  const items = checklist.items
  const graded = items.filter((i) => ['pass', 'fail'].includes(answers[i.itemId]?.response))
  const failed = graded.filter((i) => answers[i.itemId].response === 'fail')
  const skipped = items.filter((i) => answers[i.itemId]?.response === 'na')
  const answered = graded.length + skipped.length
  const score = graded.length ? Math.round(((graded.length - failed.length) / graded.length) * 100) : 0

  const set = (id, patch) => setAnswers((p) => ({ ...p, [id]: { ...p[id], ...patch } }))

  return (
    <div>
      <ProductStyles />

      <PageHeading
        back={{ label: 'Back to setup', onClick: onBack }}
        title={checklist.name}
        subtitle={`${asset.assetName} · ${asset._site} · ${details.inspector} · ${details.date}`}
      />

      {/* The running total, pinned under the header — a technician filling in a
          sheet needs to see where they are without scrolling back up. */}
      <div style={styles.progressBar}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: SUB }}>
            <strong style={{ color: INK }}>{answered}</strong> of {items.length} answered
            {failed.length > 0 && <> · <strong style={{ color: '#dc2626' }}>{failed.length} failed</strong></>}
            {skipped.length > 0 && <> · {skipped.length} not applicable</>}
          </div>
          <div style={styles.track}>
            <div style={{ ...styles.fill, width: `${(answered / items.length) * 100}%` }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: graded.length ? (score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626') : MUTE, letterSpacing: '-0.02em' }}>
            {graded.length ? `${score}%` : '—'}
          </div>
          <div style={{ fontSize: 10.5, color: MUTE }}>running score</div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Icons.clipboard} title="This checklist has no items." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item, i) => {
            const a = answers[item.itemId] || {}
            return (
              <RecordCard key={item.itemId}>
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <span style={styles.num}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.itemText}>
                        {item.text}
                        {item.critical && <span style={styles.criticalDot} title="On a class the client rates Critical" />}
                      </div>
                      <div style={styles.itemMeta}>
                        {[item.assetClass || item.section, item.frequency, item.standard]
                          .filter(Boolean).join(' · ')} · records a {responseOf(item).toLowerCase()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {[
                        { key: 'pass', label: 'Pass', on: '#16a34a' },
                        { key: 'fail', label: 'Fail', on: '#dc2626' },
                        { key: 'na', label: 'N/A', on: '#64748b' },
                      ].map((b) => (
                        <button key={b.key} onClick={() => set(item.itemId, { response: a.response === b.key ? null : b.key })}
                          style={{
                            ...styles.answer,
                            ...(a.response === b.key ? { background: b.on, borderColor: b.on, color: '#fff' } : null),
                          }}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* A line that asks for a measurement gets somewhere to write
                      it. Pass/fail alone throws away the number, which is the
                      whole point of a task that says "measure". */}
                  {(wantsReading(item) || a.response) && (
                    <div style={styles.answerExtras}>
                      {wantsReading(item) && (
                        <input value={a.value || ''} onChange={(e) => set(item.itemId, { value: e.target.value })}
                          placeholder="Measured value" style={{ ...styles.input, maxWidth: 200 }} />
                      )}
                      <input value={a.note || ''} onChange={(e) => set(item.itemId, { note: e.target.value })}
                        placeholder={a.response === 'fail' ? 'What was wrong? (recorded as a finding)' : 'Observation (optional — recorded as a finding)'}
                        style={styles.input} />
                    </div>
                  )}
                </div>
              </RecordCard>
            )
          })}
        </div>
      )}

      <div style={styles.footer}>
        <div style={{ fontSize: 12.5, color: SUB, minWidth: 0 }}>
          {answered === items.length
            ? 'Every line answered.'
            : `${items.length - answered} line${items.length - answered === 1 ? '' : 's'} still unanswered — saving as in progress keeps them open.`}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionButton variant="ghost" disabled={saving} onClick={() => onComplete('In progress')}>
            Save as in progress
          </ActionButton>
          <ActionButton disabled={saving || answered === 0} onClick={() => onComplete('Completed')}>
            {saving ? 'Saving…' : 'Complete inspection'}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

const styles = {
  stepHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  stepNum: {
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
    background: '#eef2ff', color: ACCENT, fontSize: 12.5, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  stepNumDone: { background: '#16a34a', color: '#fff' },
  stepTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: INK, letterSpacing: '-0.01em' },
  hint: { fontSize: 11, fontWeight: 700, color: MUTE, background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 999, padding: '2px 9px' },

  muted: { margin: '8px 0 0', fontSize: 12.5, color: MUTE, lineHeight: 1.55 },

  picked: {
    display: 'flex', alignItems: 'center', gap: 12,
    border: `1px solid ${LINE}`, borderRadius: 11, padding: 12, background: '#fcfdfe',
  },
  pickedName: { fontSize: 14, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pickedMeta: { fontSize: 11.5, color: MUTE, marginTop: 3 },
  change: {
    height: 30, padding: '0 12px', borderRadius: 8, border: `1px solid ${LINE}`,
    background: '#fff', color: ACCENT, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
  },
  derived: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: SUB },

  tile: {
    width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: '#eef2ff', color: ACCENT,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  code: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, fontWeight: 700, color: ACCENT },

  optionList: {
    marginTop: 10, border: `1px solid ${LINE}`, borderRadius: 11,
    maxHeight: 320, overflowY: 'auto', background: '#fff',
  },
  option: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '10px 13px', background: '#fff', border: 'none',
    borderBottom: `1px solid #f1f5f9`, cursor: 'pointer', fontFamily: 'inherit',
  },

  pickerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 },
  switch: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: SUB, cursor: 'pointer' },
  checkOption: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: 13, borderRadius: 11, border: `1px solid ${LINE}`, background: '#fff',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  checkOptionOn: { borderColor: ACCENT, background: '#f5f7ff', boxShadow: `0 0 0 1px ${ACCENT}` },
  radio: { width: 16, height: 16, borderRadius: '50%', border: '2px solid #cbd5e1', flexShrink: 0 },
  radioOn: { borderColor: ACCENT, borderWidth: 5 },

  fields: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' },
  fieldLabel: { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 },
  input: {
    width: '100%', height: 36, padding: '0 10px', fontSize: 12.5, fontFamily: 'inherit',
    color: INK, border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', outline: 'none',
  },

  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, flexWrap: 'wrap', marginTop: 16,
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '13px 16px',
  },

  progressBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18,
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12,
    padding: '13px 16px', marginBottom: 14, flexWrap: 'wrap',
  },
  track: { height: 7, borderRadius: 999, background: '#eef2f7', marginTop: 8, minWidth: 220, overflow: 'hidden' },
  fill: { height: '100%', background: ACCENT, borderRadius: 999, transition: 'width .25s ease' },

  num: {
    width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: '#eef2ff', color: ACCENT,
    fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itemText: { fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.45 },
  itemMeta: { fontSize: 11, color: MUTE, marginTop: 4 },
  criticalDot: { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#dc2626', marginLeft: 7, verticalAlign: 'middle' },
  answer: {
    height: 30, padding: '0 12px', borderRadius: 8, border: `1px solid ${LINE}`,
    background: '#fff', color: SUB, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  },
  answerExtras: { display: 'flex', gap: 8, marginTop: 11, paddingLeft: 35, flexWrap: 'wrap' },
}
