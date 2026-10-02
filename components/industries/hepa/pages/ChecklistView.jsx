'use client'

// A checklist, as its own page.
//
// The product's view screen (inspection/checklist/view/[id]) opens with a header
// carrying the name, the code and the actions, a stat row across the top, then
// two columns: the checklist's own particulars on the left and its sections and
// items on the right. Every item is a card, not a row, because an item carries a
// response type, an instruction, an acceptable band and its capture
// requirements — six things a table column cannot hold without becoming noise.
//
// The stat row is drawn with the same summary cards the Inspection screens use,
// so a reader moving between the two is reading one product rather than two.
//
// ── one addition ──────────────────────────────────────────────────────────
//
// Run Checklist. The product runs a checklist from the inspection report and
// this portal does too, but the checklists here are also worked through on their
// own — a changeover or an integrity test is not a scheduled round — and a run
// is the record that turns a procedure into evidence. It will not complete
// part-answered: a checklist signed off with three steps unanswered is a record
// saying the procedure was followed when nobody knows that it was, which is
// worse than no record at all.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import { SummaryCards, Action, Pill, TONE, Glyph, EmptyPanel, InfoBlock } from '../lib/productKit'
import { Mark, Panel, Field, Picker, TextArea, IconButton } from '../lib/checklistKit'
import { FILTER_VIEW, TECHNICIANS, USER, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import { useChecklistRuns, completeChecklist } from '../lib/ops'
import { libraryOf, featuresOf, FEATURE_TONE } from '../lib/checklistLibrary'
import { RESPONSE_TYPES, SCORING_METHODS, allItems } from '../lib/checklists'

const { INK, SUB, MUTE, LINE } = PALETTE

const LIST = '/portal/hepa/checklists'

const scoringLabel = (v) => SCORING_METHODS.find((s) => s.value === v)?.label || String(v || '').replace('_', '/')

export default function ChecklistView({ id }) {
  const router = useRouter()
  const store = useStore()
  const runs = useChecklistRuns()

  const authored = store?.records?.hepa_checklist || []
  const library = useMemo(() => libraryOf(authored), [authored])
  const checklist = library.find((c) => c.key === id || c.code === id) || null

  const [running, setRunning] = useState(false)
  const [answers, setAnswers] = useState({})
  const [filterId, setFilterId] = useState('')
  const [technicianName, setTechnicianName] = useState(USER.name)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const items = useMemo(() => allItems(checklist), [checklist])
  const ourRuns = useMemo(() => runs.filter((r) => r.templateId === id), [runs, id])

  if (!checklist) {
    return (
      <div>
        <PageHeading
          title="Checklist not found"
          subtitle={`Nothing in the library carries the reference ${id}.`}
          back={{ label: 'Back to Checklists', onClick: () => router.push(LIST) }}
        />
        <EmptyPanel title="No such checklist">
          It may have been deleted, or the reference may be mistyped.
        </EmptyPanel>
      </div>
    )
  }

  const answered = items.filter((_, i) => answers[i]).length
  const failed = items.filter((_, i) => answers[i] === 'fail').length
  const outstanding = items.length - answered

  const duplicate = () => {
    window.sessionStorage.setItem('hepa_checklist_seed', JSON.stringify({ mode: 'duplicate', checklist }))
    router.push('/portal/hepa/checklists/new')
  }

  const edit = () => {
    if (checklist.source === 'system') {
      store?.notify('A checklist from the system library cannot be edited. Duplicate it and edit the copy.', 'error')
      return
    }
    window.sessionStorage.setItem('hepa_checklist_seed', JSON.stringify({ mode: 'edit', checklist }))
    router.push('/portal/hepa/checklists/new')
  }

  const submit = async () => {
    setBusy(true)
    const saved = await completeChecklist(
      store,
      // A run keeps its own copy of the steps it was answered against. A run
      // recorded last month has to still read correctly after the checklist
      // behind it is edited, which it cannot do if it only holds a reference.
      { id: checklist.key, name: checklist.name, items: items.map((i) => i.description) },
      { checks: answers, filterId, technicianName, notes, outcome: failed ? 'Fail' : 'Pass' },
    )
    setBusy(false)
    if (saved) {
      setRunning(false)
      setAnswers({})
      setNotes('')
    }
  }

  return (
    <div>
      {/* The checklist's own name is the heading, as it is in the product —
          its h1 is `checklist.ChecklistName`, not the module's title. A record
          page headed with the name of the list it came from tells the reader
          where they are and not what they are looking at, and it reads
          identically to the library screen one click behind it. */}
      <PageHeading
        title={checklist.name}
        subtitle={`${checklist.standard} · ${checklist.code}`}
        back={{ label: 'Back to Checklists', onClick: () => router.push(LIST) }}
      />

      <div style={styles.sheet}>
        <div style={styles.sheetTop}>
          <span style={styles.sheetTile}>
            <Glyph name="clipboard" size={22} color={MUTE} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* No name here: it is the page heading now, and a record that
                states its own name twice within 60px reads as a mistake. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              {/* Neither of these is a state to fix. Active is the ordinary
                  case and "My Organization" is where a checklist came from, so
                  both are drawn the same as the text around them. */}
              <Pill tone="slate">{checklist.archived ? 'Archived' : 'Active'}</Pill>
              <Pill tone="slate">
                {checklist.source === 'system' ? 'From System' : 'My Organization'}
              </Pill>
              {checklist.generatedBy && <Pill tone="slate">Generated by {checklist.generatedBy}</Pill>}
            </div>
            <div style={styles.metaRow}>
              <span><strong style={{ color: SUB }}>Code:</strong> <span style={styles.code}>{checklist.code}</span></span>
              <span style={styles.metaItem}><Glyph name="calendar" size={13} color={MUTE} />Created {checklist.createdAt ? fmtDate(checklist.createdAt) : '—'}</span>
              <span style={styles.metaItem}><Glyph name="user" size={13} color={MUTE} />by {checklist.author}</span>
              <span style={styles.metaItem}><Glyph name="doc" size={13} color={MUTE} />{checklist.standard}</span>
            </div>
            {checklist.what && <p style={styles.what}>{checklist.what}</p>}
          </div>

          <div style={styles.actions}>
            {!running && !checklist.archived && (
              <Action icon="play" primary onClick={() => { setRunning(true); setAnswers({}); setNotes(''); setFilterId('') }}>
                Run Checklist
              </Action>
            )}
            <Action icon="download" onClick={duplicate}>Duplicate</Action>
            {checklist.source !== 'system' && <Action icon="wrench" onClick={edit}>Edit</Action>}
          </div>
        </div>
      </div>

      {/* All six neutral. These describe how a checklist is built — nothing
          here is a state to fix, not even the critical count: a step whose
          failure stops the inspection is a design decision, and eight of them
          on a ten-step procedure is the procedure working as intended. Colour
          on this row would be decoration, and it would train the reader to
          ignore it on the screens where it means something. */}
      <SummaryCards cards={[
        { key: 'items', label: 'Total Items', value: checklist.itemCount, icon: 'clipboard' },
        { key: 'sections', label: 'Sections', value: checklist.sectionCount, icon: 'list' },
        { key: 'required', label: 'Required Items', value: checklist.requiredCount, icon: 'check' },
        { key: 'critical', label: 'Critical Items', value: checklist.criticalCount, icon: 'warning' },
        { key: 'scoring', label: 'Scoring Method', value: scoringLabel(checklist.scoringMethod), icon: 'target' },
        { key: 'passing', label: 'Passing Score', value: `${checklist.passingScore}%`, icon: 'gauge' },
      ]} />

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        {featuresOf(checklist).map((f) => <Pill key={f} tone={FEATURE_TONE[f]}>{f}</Pill>)}
        <Pill tone="slate">Asset level: {checklist.assetLevel}</Pill>
        {checklist.cleanroomName && <Pill tone="slate">{checklist.cleanroomName}</Pill>}
        {ourRuns.length > 0 && <Pill tone="slate">{ourRuns.length} run{ourRuns.length === 1 ? '' : 's'} recorded</Pill>}
      </div>

      {running && (
        <Runner
          checklist={checklist} items={items} answers={answers} setAnswers={setAnswers}
          filterId={filterId} setFilterId={setFilterId}
          technicianName={technicianName} setTechnicianName={setTechnicianName}
          notes={notes} setNotes={setNotes}
          answered={answered} outstanding={outstanding} failed={failed}
          busy={busy} onCancel={() => setRunning(false)} onSubmit={submit}
        />
      )}

      <div style={styles.columns}>
        <div style={{ minWidth: 0 }}>
          <Panel title="Basic Information" icon="sliders">
            <Rows items={[
              ['Checklist code', <span key="c" style={styles.code}>{checklist.code}</span>],
              ['Version', checklist.version],
              ['Standard', checklist.standard],
              ['Category', checklist.category],
              ['Asset level', checklist.assetLevel],
              ['Location type', checklist.locationType || '—'],
              checklist.cleanroomName ? ['Cleanroom', checklist.cleanroomName] : null,
              checklist.filterId ? ['Filter', checklist.filterId] : null,
              ['Status', checklist.archived ? 'Archived' : 'Active'],
            ].filter(Boolean)} />
          </Panel>

          <Panel title="Scoring Configuration" icon="target" tone="#d97706">
            <Rows items={[
              ['Scoring method', scoringLabel(checklist.scoringMethod)],
              ['Passing score', `${checklist.passingScore}%`],
              ['Critical items', `${checklist.criticalCount} of ${checklist.itemCount}`],
            ]} />
          </Panel>

          <Panel title="Revision History" icon="clock" tone="#7c3aed">
            <Rows items={[
              ['Created', checklist.createdAt ? fmtDate(checklist.createdAt) : '—'],
              ['Created by', checklist.author],
              checklist.modifiedAt ? ['Last modified', fmtDate(checklist.modifiedAt)] : null,
              checklist.modifiedBy ? ['Modified by', checklist.modifiedBy] : null,
              ['Source', checklist.source === 'system' ? 'Shipped with the portal' : 'Authored in the portal'],
            ].filter(Boolean)} />
          </Panel>

          {checklist.sources?.length > 0 && (
            <InfoBlock tone="slate" icon="doc" label="Drawn from">
              {checklist.sources.map((s) => s.name).join(', ')}
            </InfoBlock>
          )}

          {ourRuns.length > 0 && (
            <Panel title="Recent Runs" icon="check" tone="#059669">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ourRuns.slice(0, 6).map((r) => (
                  <div key={r.recordId} style={styles.run}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={styles.runTitle}>{r.filterId || '—'}</span>
                      <span style={styles.runSub}>{r.completedBy} · {fmtDate(r.completedAt)}</span>
                    </span>
                    <Pill tone={r.outcome === 'Fail' ? 'red' : 'green'}>{r.outcome}</Pill>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <Panel title="Checklist Items" icon="list"
            right={<Pill tone="slate">{checklist.itemCount} item{checklist.itemCount === 1 ? '' : 's'}</Pill>}>
            {checklist.sections?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {checklist.sections.map((s, si) => (
                  <div key={s.id || si}>
                    <div style={styles.sectionHead}>
                      <span style={styles.sectionNo}>{si + 1}</span>
                      <h4 style={styles.sectionName}>{s.name}</h4>
                      <Pill tone="slate">
                        {(s.items?.length || 0) + (s.subSections || []).reduce((n, ss) => n + (ss.items?.length || 0), 0)} items
                      </Pill>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(s.items || []).map((item) => <ItemCard key={item.id} item={item} />)}
                    </div>

                    {(s.subSections || []).map((ss) => (
                      <div key={ss.id} style={styles.subBlock}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                          <Mark name="layers" size={15} color="#7c3aed" />
                          <h5 style={styles.subName}>{ss.name}</h5>
                          <Pill tone="slate">{ss.items?.length || 0} items</Pill>
                        </div>
                        {ss.instruction && <p style={styles.subInstruction}>{ss.instruction}</p>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {(ss.items || []).map((item) => <ItemCard key={item.id} item={item} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No items found">
                This checklist does not carry any items yet.
              </EmptyPanel>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Rows({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map(([k, v]) => (
        <div key={k} style={styles.detailRow}>
          <span style={styles.detailKey}>{k}</span>
          <span style={styles.detailVal}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/** One item, as the product draws it: number, response type, badges, then the step. */
function ItemCard({ item }) {
  const type = RESPONSE_TYPES.find((r) => r.value === item.responseType) || RESPONSE_TYPES[0]
  return (
    <div style={styles.itemCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={styles.itemNo}>{item.itemNumber}</span>
        <span style={styles.itemType}>
          <Mark name={type.icon} size={14} color={SUB} />{type.label}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {item.critical && <Pill tone="red">Critical</Pill>}
          {item.required !== false && <Pill tone="slate">Mandatory</Pill>}
        </span>
      </div>

      <p style={styles.itemText}>{item.description}</p>
      {item.instruction && <p style={styles.itemInstruction}>{item.instruction}</p>}

      {(item.min || item.max || item.options?.length > 0) && (
        <div style={styles.itemSpec}>
          {(item.min || item.max) && (
            <div style={styles.specRow}>
              <span style={styles.specKey}>Acceptable range</span>
              <span style={styles.specVal}>
                {item.min || '—'} to {item.max || '—'}{item.unit ? ` ${item.unit}` : ''}
              </span>
            </div>
          )}
          {item.options?.length > 0 && (
            <div style={styles.specRow}>
              <span style={styles.specKey}>Options</span>
              <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {item.options.map((o) => <Pill key={o} tone="slate">{o}</Pill>)}
              </span>
            </div>
          )}
        </div>
      )}

      {(item.requiresPhoto || item.requiresComment || item.requiresSignature) && (
        <div style={styles.itemFlags}>
          {item.requiresPhoto && <Pill tone="slate">Photo</Pill>}
          {item.requiresComment && <Pill tone="slate">Comment</Pill>}
          {item.requiresSignature && <Pill tone="slate">Signature</Pill>}
        </div>
      )}
    </div>
  )
}

/**
 * Working the checklist through.
 *
 * The Complete button stays disabled while anything is unanswered and says how
 * many, because the cost of a half-finished record is paid by whoever reads it
 * next and cannot tell which half is missing.
 */
function Runner({
  checklist, items, answers, setAnswers, filterId, setFilterId,
  technicianName, setTechnicianName, notes, setNotes,
  answered, outstanding, failed, busy, onCancel, onSubmit,
}) {
  const ready = outstanding === 0 && Boolean(filterId)

  return (
    <div style={styles.runner}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 13 }}>
        <Glyph name="play" size={16} color="#ea7317" />
        <h3 style={styles.runnerTitle}>Working through {checklist.name}</h3>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: outstanding ? '#b45309' : '#047857' }}>
          {answered} / {items.length}
        </span>
        <IconButton icon="x" title="Cancel run" onClick={onCancel} />
      </div>

      <div style={styles.track}>
        <div style={{
          width: `${(answered / Math.max(1, items.length)) * 100}%`, height: '100%', borderRadius: 999,
          background: outstanding ? '#d97706' : '#059669', transition: 'width .2s',
        }} />
      </div>

      <div style={styles.runnerFields}>
        <Field label="Filter this run was against" required>
          <Picker value={filterId} onChange={setFilterId} placeholder="Select a filter"
            options={FILTER_VIEW.map((f) => ({ value: f.filterId, label: `${f.filterId} — ${f.cleanroomName}` }))} />
        </Field>
        <Field label="Technician">
          <Picker value={technicianName} onChange={setTechnicianName}
            options={[USER.name, ...TECHNICIANS.map((t) => t.name).filter((n) => n !== USER.name)]} />
        </Field>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
        {items.map((item, i) => (
          <div key={item.id || i} style={styles.step}>
            <span style={styles.stepNo}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={styles.stepText}>{item.description}</span>
              {item.critical && <Pill tone="red">Critical</Pill>}
            </span>
            <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {[['pass', 'Pass', '#059669'], ['fail', 'Fail', '#dc2626'], ['na', 'N/A', '#94a3b8']].map(([v, label, colour]) => (
                <button key={v} onClick={() => setAnswers((p) => ({ ...p, [i]: v }))}
                  style={{
                    ...styles.answer,
                    borderColor: answers[i] === v ? colour : LINE,
                    background: answers[i] === v ? colour : '#fff',
                    color: answers[i] === v ? '#fff' : SUB,
                  }}>{label}</button>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="Notes">
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={failed ? 'What failed, and what was done about it?' : 'Anything worth recording'} />
        </Field>
      </div>

      <div style={styles.runnerFoot}>
        <span style={{ fontSize: 12, color: outstanding ? '#b45309' : MUTE }}>
          {outstanding > 0
            ? `${outstanding} step${outstanding === 1 ? '' : 's'} still unanswered.`
            : !filterId ? 'Say which filter this run was against.'
              : failed ? `${failed} step${failed === 1 ? '' : 's'} failed — this run records as a fail.`
                : 'Every step answered.'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Action onClick={onCancel}>Cancel</Action>
          <Action icon="check" primary onClick={onSubmit} disabled={!ready || busy}>
            {busy ? 'Saving…' : 'Complete Checklist'}
          </Action>
        </span>
      </div>
    </div>
  )
}

const styles = {
  sheet: {
    background: '#fff', borderRadius: 12, padding: '18px 20px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  sheetTop: { display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' },
  sheetTile: {
    width: 44, height: 44, borderRadius: 11, display: 'grid', placeItems: 'center', flexShrink: 0,
    background: TONE.blue.bg, borderStyle: 'solid', borderWidth: 1, borderColor: TONE.blue.bd,
  },
  metaRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 9, fontSize: 12, color: MUTE },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  code: {
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 11.5, color: INK,
    background: '#f1f5f9', padding: '2px 8px', borderRadius: 6,
  },
  what: { margin: '11px 0 0', fontSize: 13, color: SUB, lineHeight: 1.6, maxWidth: 720 },
  actions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 },

  columns: { display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(0,2fr)', gap: 18, alignItems: 'start' },

  detailRow: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 11px',
    borderRadius: 9, background: '#f8fafc', borderStyle: 'solid', borderWidth: 1, borderColor: '#eef2f7',
  },
  detailKey: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: SUB },
  detailVal: { fontSize: 12.5, fontWeight: 700, color: INK, textAlign: 'right', minWidth: 0 },

  sectionHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  sectionNo: {
    width: 27, height: 27, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0,
    background: TONE.blue.bg, color: TONE.blue.fg, fontSize: 12, fontWeight: 800,
  },
  sectionName: { margin: 0, fontSize: 15, fontWeight: 700, color: INK, minWidth: 0 },

  subBlock: {
    marginTop: 14, padding: '13px 14px', borderRadius: 11, background: '#fbfcff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  subName: { margin: 0, fontSize: 13.5, fontWeight: 700, color: INK, minWidth: 0 },
  subInstruction: { margin: '0 0 10px', fontSize: 12, color: SUB, lineHeight: 1.55 },

  itemCard: {
    padding: '13px 14px', borderRadius: 11, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  itemNo: {
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontSize: 12, fontWeight: 700,
    color: INK, background: '#f1f5f9', padding: '3px 9px', borderRadius: 6, flexShrink: 0,
  },
  itemType: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: SUB },
  itemText: { margin: '10px 0 0', fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.55 },
  itemInstruction: { margin: '5px 0 0', fontSize: 12, color: MUTE, lineHeight: 1.55 },
  itemSpec: {
    marginTop: 10, padding: '9px 11px', borderRadius: 9, background: '#f8fafc',
    display: 'flex', flexDirection: 'column', gap: 7,
  },
  specRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  specKey: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: SUB },
  specVal: { fontSize: 12, fontWeight: 700, color: INK },
  itemFlags: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}` },

  runner: {
    background: '#fbfcff', borderRadius: 12, padding: '16px 18px', marginBottom: 16,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#c7d2fe',
  },
  runnerTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: INK, minWidth: 0 },
  track: { height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' },
  runnerFields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 13, marginTop: 14 },
  step: {
    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap',
    padding: '9px 11px', borderRadius: 9, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  stepNo: { fontSize: 11, fontWeight: 700, color: MUTE, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  stepText: { fontSize: 12.5, color: INK, lineHeight: 1.5, marginRight: 8 },
  answer: {
    padding: '5px 11px', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit',
    cursor: 'pointer', borderRadius: 7, borderStyle: 'solid', borderWidth: 1,
  },
  runnerFoot: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 },

  run: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 9,
    background: '#f8fafc', borderStyle: 'solid', borderWidth: 1, borderColor: '#eef2f7',
  },
  runTitle: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK },
  runSub: { display: 'block', fontSize: 11, color: MUTE, marginTop: 2 },
}
