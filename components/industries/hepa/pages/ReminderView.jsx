'use client'

// One inspection reminder's record.
//
// The product's own layout, kept in its order: the reference and its state in
// the heading with Edit beside them, then a two-thirds column carrying Basic
// Information and the rounds this reminder has generated, and a third column
// carrying the recurrence schedule, the reminder's own counts, and the audit
// trail. Nothing is reordered for looks — a reviewer who knows this screen in
// the product should not have to hunt for the interval.
//
// A page rather than a panel, for the reason every record in this portal is
// one: it can be linked to, opened in a second tab and closed with the back
// button, and all three of those happen in a review.
//
// The due state is not read off the row. It is recomputed from `dueDate`
// through the same rule the list uses — imported rather than copied, because
// two screens quietly disagreeing about whether a round is overdue is worse
// than either of them being wrong.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import { InfoBlock, EmptyPanel, Action, Pill, Glyph, TONE } from '../lib/productKit'
import { FILTER_VIEW, CLEANROOMS, TECHNICIANS, USER, fmtDate } from '../lib/data'
import { useStore } from '../lib/store'
import { roundById, checklistOutline } from '../lib/data/inspections'
import { TEMPLATES } from '../lib/checklists'
import {
  KIND, keyOf, useReminders, checklistFor, originOf, inspectionsFor, DUE_TONE,
  REPORT_STATUS_TONE, LocalIcon, Modal, FormCard, Field, Toggle, ChecklistSelectionGrid,
} from './InspectionReminder'

const { INK, SUB, MUTE, LINE } = PALETTE

export default function ReminderView({ id }) {
  const router = useRouter()
  const store = useStore()
  const stored = store?.records?.[KIND] || []

  const all = useReminders()
  const r = useMemo(() => all.find((row) => row.reminderId === id) || null, [all, id])

  const [editing, setEditing] = useState(false)

  const back = () => router.push('/portal/hepa/inspection-reminder')

  if (!r) {
    return (
      <div>
        <PageHeading
          title="Inspection reminder not found"
          subtitle={`Nothing on the register carries the reference ${id}.`}
          back={{ label: 'Back to Inspection Reminders', onClick: back }}
        />
        <EmptyPanel title="No such reminder">
          It may have been deleted, or the reference may be mistyped.
        </EmptyPanel>
      </div>
    )
  }

  const type = roundById(r.roundId)
  const checklist = checklistFor(r)
  const outline = checklist ? checklistOutline(checklist) : []
  const steps = checklist ? checklist.steps : []
  const origin = originOf(r)
  const generated = inspectionsFor(r, stored)
  const filter = r.filterId ? FILTER_VIEW.find((f) => f.filterId === r.filterId) : null
  const patch = stored.find((row) => row.reminderId === r.reminderId)
  const tone = TONE[DUE_TONE[r.status]] || TONE.slate

  return (
    <div>
      <PageHeading
        title={`${r.round} (${r.reminderId})`}
        subtitle="Inspection Reminder Details"
        back={{ label: 'Back', onClick: back }}
        right={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pill tone={r.isActive ? 'green' : 'slate'}>{r.isActive ? 'Active' : 'Inactive'}</Pill>
            {r.autoGenerate && (
              <span style={styles.outlinePill}>
                <Glyph name="check" size={12} color={SUB} /> Auto Generate
              </span>
            )}
            {r._asepticCore && <Pill tone="violet">Aseptic core</Pill>}
            <Pill tone={DUE_TONE[r.status]}>{r.status}</Pill>
            <Action primary onClick={() => setEditing(true)}>
              <LocalIcon name="pencil" size={13} color="#fff" />Edit
            </Action>
          </div>
        )}
      />

      <div style={styles.columns}>
        <div style={{ minWidth: 0 }}>
          {/* ── Basic Information ─────────────────────────────────────────── */}
          <div style={styles.sheet}>
            <SectionHead icon="sliders" title="Basic Information" />

            <div style={styles.pairGrid}>
              <Labelled icon="user" label="Assigned To">{r.assignedTo || 'Not Assigned'}</Labelled>
              <Labelled icon="clock" label="Notification Time">{r.notifyAt || 'N/A'}</Labelled>
            </div>

            <div style={styles.pairGrid}>
              <Labelled icon="calendar" label="Next Due Date">
                <span style={{ color: tone.fg, fontWeight: 700 }}>{fmtDate(r.dueDate)}</span>
                <span style={{ color: MUTE, fontWeight: 500 }}>
                  {r._overdue
                    ? ` — ${Math.abs(r._daysAway)} day${Math.abs(r._daysAway) === 1 ? '' : 's'} late`
                    : r._daysAway === 0 ? ' — today'
                      : ` — in ${r._daysAway} day${r._daysAway === 1 ? '' : 's'}`}
                </span>
              </Labelled>
              <Labelled icon="refresh" label="Then">{fmtDate(r.nextAfter)}</Labelled>
            </div>

            <Labelled label="Description">{r.description || type?.what || 'N/A'}</Labelled>

            <div style={{ marginTop: 13 }}>
              <InfoBlock tone="slate" icon="box" label="Asset">
                {r.filterId ? (
                  <>
                    <strong>{r.filterId}</strong>
                    <span style={styles.dim}>
                      {' '}— {r.cleanroomName}, {r.isoClass}
                      {filter?.concern ? ` · ${filter.concern}` : ''}
                    </span>
                  </>
                ) : (
                  <span style={styles.dim}>Room-wide — this round is walked against the whole room rather than one unit.</span>
                )}
              </InfoBlock>

              <InfoBlock tone="slate" icon="pin" label="Location">
                <strong>{r.cleanroomName}</strong>
                <span style={styles.dim}> — {r.isoClass}{r._asepticCore ? ', the aseptic core' : ''}</span>
                <div style={styles.code}>{r.cleanroomId}</div>
              </InfoBlock>

              {checklist ? (
                <InfoBlock tone="slate" icon="doc" label="Inspection Checklist">
                  <strong>{checklist.name}{checklist.code ? ` (${checklist.code})` : ''}</strong>
                  <span style={{ marginLeft: 8 }}><Pill tone="slate">Active</Pill></span>
                  <p style={{ margin: '7px 0 0', fontSize: 12, color: SUB, lineHeight: 1.55 }}>
                    Description: {checklist.what}
                  </p>

                  <div style={styles.checklistFacts}>
                    <Stat label="Asset Level" value={r.appliesTo === 'filter' ? 'Component' : 'Area'} />
                    <Stat label="Scoring" value="Pass / Fail" />
                    <Stat label="Sections" value={outline.length} />
                    <Stat label="Items" value={steps.length} />
                  </div>

                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
                    <Pill tone="slate">{checklist.standard}</Pill>
                    <Pill tone="slate">{r.frequency}</Pill>
                  </div>
                </InfoBlock>
              ) : (
                <EmptyPanel title="No checklist assigned">
                  A round with no checklist behind it records a result nobody can audit back to a
                  step, and an inspection cannot be created from it.
                </EmptyPanel>
              )}

              <AnalysisPanel r={r} filter={filter} generated={generated} />
            </div>
          </div>

          {/* ── Generated Inspections ─────────────────────────────────────── */}
          {generated.length > 0 ? (
            <div style={styles.sheet}>
              <SectionHead icon="clipboard" title={`Generated Inspections (${generated.length})`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {generated.map((g, i) => (
                  <div key={g.reportId} style={styles.genRow}>
                    <span style={styles.genNo}>{i + 1}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: 12.5, color: INK }}>{g.reportId}</strong>
                      <span style={styles.genSub}>
                        {fmtDate(g.date)} · {g.inspector || g.assignee || 'Unassigned'}
                        {g.result ? ` · ${g.result}` : ''}
                      </span>
                    </span>
                    <Pill tone={REPORT_STATUS_TONE[g.status] || 'slate'}>{g.status}</Pill>
                    <button
                      onClick={() => router.push(`/portal/hepa/inspections/${g.reportId}`)}
                      style={styles.eyeBtn}
                      aria-label={`View ${g.reportId}`}
                    >
                      <LocalIcon name="eye" size={14} color="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyPanel title="No inspections generated from this reminder yet">
              The first round created from here becomes the baseline the next one is read against.
            </EmptyPanel>
          )}
        </div>

        {/* ── sidebar ───────────────────────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>
          <div style={styles.sheet}>
            <SectionHead icon="refresh" title="Recurrence Schedule" />
            {r.intervalDays ? (
              <div style={styles.intervalRow}>
                <span style={styles.dot} />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 12.5, color: INK }}>
                    Every {r.intervalDays} day{r.intervalDays > 1 ? 's' : ''}
                  </strong>
                  <span style={styles.genSub}>Interval Type: {r.frequency}</span>
                  <span style={styles.genSub}>{r.standard}</span>
                </span>
              </div>
            ) : (
              <div style={styles.alert}>
                <Glyph name="warning" size={14} color="#b45309" />
                <span>No interval configured</span>
              </div>
            )}
          </div>

          <div style={styles.sheet}>
            <SectionHead icon="clipboard" title="Reminder Details" />
            <KeyRow label="Total Intervals" value={1} />
            <KeyRow label="Auto Generate Inspection" value={<Pill tone={r.autoGenerate ? 'green' : 'slate'}>{r.autoGenerate ? 'Yes' : 'No'}</Pill>} />
            <KeyRow label="Total Inspections" value={generated.length} />
            <KeyRow label="Last Walked" value={r.last ? fmtDate(r.last.date) : 'Never walked'} />
          </div>

          <div style={styles.sheet}>
            <SectionHead icon="doc" title="Audit Trail" />
            <div style={styles.auditRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ ...styles.dot, background: '#059669' }} />
                <strong style={{ fontSize: 12.5, color: INK }}>Created</strong>
              </div>
              <p style={styles.auditLine}>By: {origin.by || 'System'}</p>
              <p style={styles.auditSub}>{fmtDate(origin.on)}</p>
            </div>

            {patch?.modifiedOn && (
              <div style={styles.auditRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...styles.dot, background: '#2563eb' }} />
                  <strong style={{ fontSize: 12.5, color: INK }}>Last Modified</strong>
                </div>
                <p style={styles.auditLine}>By: {patch.modifiedBy || 'System'}</p>
                <p style={styles.auditSub}>{fmtDate(patch.modifiedOn)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditReminderModal
          r={r}
          ready={store.ready}
          onClose={() => setEditing(false)}
          onSave={async (payload) => {
            const saved = await store.update(KIND, keyOf(r), {
              ...payload,
              reminderId: r.reminderId,
              modifiedBy: USER.name,
              modifiedOn: new Date().toISOString().slice(0, 10),
            })
            if (!saved) return
            store.notify?.('Inspection reminder updated successfully')
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * Synapse AI Suggestions.
 *
 * Drawn only where the register has something to say — the product renders this
 * section from an analysis field that is usually absent, and a panel that
 * appears on every record is a panel nobody reads. What it says is assembled
 * from what is already on file: how late the round is, what the last one found,
 * and whether the unit it covers has a standing concern. It does not offer an
 * opinion the data cannot support.
 */
function AnalysisPanel({ r, filter, generated }) {
  const failed = generated.find((g) => g.result === 'Fail')
  const worth = r._overdue || Boolean(failed) || Boolean(filter?.concern)
  if (!worth) return null

  const points = []
  if (r._overdue) {
    points.push(`This round is ${Math.abs(r._daysAway)} day${Math.abs(r._daysAway) === 1 ? '' : 's'} past its due date`
      + `${r._asepticCore ? ', and it covers an ISO 5 room where a lapse is a batch question rather than a housekeeping one' : ''}.`
      + ` Until it is walked, ${r.filterId || r.cleanroomName} carries no current evidence that ${r.standard} was followed.`)
  }
  if (failed) {
    points.push(`The last failed round here was ${failed.reportId} on ${fmtDate(failed.date)}`
      + `${failed.findingsCount ? `, which raised ${failed.findingsCount} finding${failed.findingsCount > 1 ? 's' : ''}` : ''}.`
      + ' A repeat failure on the same schedule is the pattern an auditor asks about.')
  }
  if (filter?.concern) {
    points.push(`${filter.filterId} carries a standing concern on the filter register: ${filter.concern}.`
      + ' The housing inspection is the round that would corroborate or clear it.')
  }

  return (
    <div style={styles.analysis}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Glyph name="pulse" size={16} color="#7c3aed" />
        <strong style={{ fontSize: 13.5, color: '#6d28d9' }}>Synapse AI Suggestions</strong>
        <span style={{ marginLeft: 'auto' }}><Pill tone="slate">From this register</Pill></span>
      </div>
      {points.map((p) => (
        <p key={p} style={styles.analysisPoint}>
          <span style={styles.analysisDot} />
          <span>{p}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Update Inspection Reminder.
 *
 * The product gives this its own route and draws it as a page: a Back button, a
 * heading, then two cards. Not three — Assignment is a bordered section inside
 * Basic Information rather than a card of its own, and the checklist grid sits
 * at the top of that same card rather than beside the asset. This portal has no
 * /edit sub-route to send anybody to, so it opens over the record instead; the
 * inside is the product's, in the product's order.
 *
 * Everything is editable here, the room and the checklist included, because that
 * is what the product allows. The one thing an edit does not touch is the date
 * already on the reminder: a changed interval takes effect from the next round
 * created against it, so correcting a schedule cannot retroactively mark a round
 * late that nobody was late for.
 */
function EditReminderModal({ r, onClose, onSave, ready }) {
  const [form, setForm] = useState(() => ({
    round: r.round,
    description: r.description || roundById(r.roundId)?.what || '',
    notifyAt: r.notifyAt || '07:00',
    isActive: r.isActive,
    sendEmail: r.sendEmail !== false,
    assignedTo: r.assignedTo || '',
    filterId: r.filterId || '',
    cleanroomId: r.filterId ? '' : (r.cleanroomId || ''),
    checklistId: (checklistFor(r) || {}).id || '',
    intervals: [{ type: r.frequency, days: r.intervalDays || 30 }],
  }))
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const setField = (patch) => setForm((p) => ({ ...p, ...patch }))

  const chosen = form.filterId ? FILTER_VIEW.find((f) => f.filterId === form.filterId) : null
  const cleanroomId = chosen ? chosen.cleanroomId : form.cleanroomId
  const cleanroom = cleanroomId ? CLEANROOMS.find((c) => c.cleanroomId === cleanroomId) : null
  const template = form.checklistId ? TEMPLATES.find((t) => t.id === form.checklistId) : null

  const submit = async () => {
    const next = {}
    if (!form.round.trim()) next.round = 'Inspection Reminder title is required'
    if (!form.notifyAt) next.notifyAt = 'Inspection Notification Time is required'
    if (!form.filterId && !form.cleanroomId) next.subject = 'Either Asset or Location must be selected'
    if (!form.assignedTo) next.assignment = 'An inspection reminder must be assigned to someone. Choose an assignee.'
    form.intervals.forEach((iv, i) => {
      if (!iv.days || iv.days < 1 || iv.days > 366) next[`interval_${i}`] = 'Value must be between 1 and 366'
    })
    setErrors(next)
    setSubmitted(true)
    if (Object.keys(next).length) return

    setSaving(true)
    // The shortest schedule wins, for the reason it does on create: a reminder
    // carrying two intervals comes round on whichever of them falls first.
    const days = Math.min(...form.intervals.map((iv) => iv.days))
    await onSave({
      round: form.round.trim(),
      roundId: template?.roundId || r.roundId || null,
      standard: template?.standard || r.standard,
      description: form.description.trim() || null,
      notifyAt: form.notifyAt,
      isActive: form.isActive,
      sendEmail: form.sendEmail,
      assignedTo: form.assignedTo,
      filterId: form.filterId || null,
      appliesTo: form.filterId ? 'filter' : 'room',
      cleanroomId: cleanroom?.cleanroomId || r.cleanroomId,
      cleanroomName: cleanroom?.name || r.cleanroomName,
      isoClass: cleanroom?.isoClass || r.isoClass,
      checklistId: form.checklistId || null,
      intervalDays: days,
      frequency: form.intervals[0].type,
    })
    setSaving(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon="bell"
      title="Update Inspection Reminder"
      width={880}
      back={{ label: 'Back', onClick: onClose }}
      footer={(
        <Action icon="check" primary onClick={submit} disabled={saving || !ready}>
          {saving ? 'Updating...' : 'Update Reminder'}
        </Action>
      )}
    >
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
        Please fill out the form below to update the inspection reminder.
      </p>

      <FormCard icon="sliders" title="Basic Information">
        <ChecklistSelectionGrid
          selectedId={form.checklistId}
          onSelect={(t) => setField({ checklistId: t.id })}
          hasSubject={Boolean(form.filterId || form.cleanroomId)}
          appliesTo={form.filterId ? 'filter' : 'room'}
        />

        <div style={{ ...styles.formGrid, marginTop: 14 }}>
          <Field label="Reminder Title" required error={errors.round} span={2}>
            <input value={form.round} onChange={(e) => setField({ round: e.target.value })}
              style={{ ...styles.input, borderColor: errors.round ? '#dc2626' : LINE }} />
          </Field>
          <Field label="Active Reminder">
            <Toggle checked={form.isActive} onChange={(v) => setField({ isActive: v })} />
          </Field>
          <Field label="Email Notification">
            <Toggle checked={form.sendEmail} onChange={(v) => setField({ sendEmail: v })} />
          </Field>
        </div>

        {/* Assignment lives inside Basic Information, bordered off the top —
            the product's own arrangement, not a card of its own. */}
        <div style={styles.assignmentBlock}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>
                Assignment <span style={{ color: '#dc2626' }}>*</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTE }}>
                Assign this reminder to the technician who walks the round.
              </p>
            </div>
            {form.assignedTo && (
              <button onClick={() => setField({ assignedTo: '' })} style={styles.clearAssign}>
                <Glyph name="cross" size={12} color={SUB} /> Clear
              </button>
            )}
          </div>
          <div style={{ maxWidth: 280 }}>
            <Field label="Assigned To">
              <select value={form.assignedTo} onChange={(e) => setField({ assignedTo: e.target.value })} style={styles.input}>
                <option value="">Select team member</option>
                {TECHNICIANS.map((t) => <option key={t.technicianId} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
          </div>
          {errors.assignment && <p style={styles.errorText}>{errors.assignment}</p>}
        </div>

        <div style={{ ...styles.formGrid, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <Field label="Description">
            <textarea rows={3} value={form.description}
              onChange={(e) => setField({ description: e.target.value })}
              style={{ ...styles.input, resize: 'vertical' }} />
          </Field>
          <Field label="Notification Time" required error={errors.notifyAt}>
            <input type="time" value={form.notifyAt}
              onChange={(e) => setField({ notifyAt: e.target.value })}
              style={{ ...styles.input, borderColor: errors.notifyAt ? '#dc2626' : LINE }} />
          </Field>
        </div>

        <div style={{ ...styles.formGrid, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <Field label="Asset">
            <select
              value={form.filterId}
              disabled={Boolean(form.cleanroomId)}
              onChange={(e) => setField({ filterId: e.target.value, cleanroomId: '', checklistId: '' })}
              style={{ ...styles.input, opacity: form.cleanroomId ? 0.5 : 1 }}
            >
              <option value="">Select an asset</option>
              {FILTER_VIEW.map((f) => (
                <option key={f.filterId} value={f.filterId}>{f.filterId} — {f.cleanroomName}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select
              value={cleanroomId}
              disabled={Boolean(form.filterId)}
              onChange={(e) => setField({ cleanroomId: e.target.value, filterId: '', checklistId: '' })}
              style={{ ...styles.input, opacity: form.filterId ? 0.5 : 1 }}
            >
              <option value="">Select location</option>
              {CLEANROOMS.map((c) => (
                <option key={c.cleanroomId} value={c.cleanroomId}>{c.name} ({c.isoClass})</option>
              ))}
            </select>
          </Field>
        </div>

        {form.filterId && (
          <p style={{ fontSize: 11, color: MUTE, margin: '0 0 10px' }}>
            Location taken from the selected asset.
          </p>
        )}

        {submitted && errors.subject && (
          <div style={styles.subjectAlert}>
            <Glyph name="warning" size={14} color="#b91c1c" />
            Either Asset or Location must be selected
          </div>
        )}
      </FormCard>

      <FormCard icon="clock" title="Recurrence Schedule">
        {form.intervals.map((iv, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} style={styles.intervalBlock}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <strong style={{ fontSize: 12.5, color: INK }}>Interval {i + 1}</strong>
              {form.intervals.length > 1 && (
                <button
                  onClick={() => setField({ intervals: form.intervals.filter((_, n) => n !== i) })}
                  style={{ ...styles.clearAssign, marginLeft: 'auto' }}
                  aria-label="Remove interval"
                >
                  <LocalIcon name="trash" size={14} color="#dc2626" />
                </button>
              )}
            </div>
            <div style={styles.formGrid}>
              <Field label="Interval Type" required>
                <select
                  value={iv.type}
                  onChange={(e) => {
                    const days = { Daily: 1, Weekly: 7, Monthly: 30, Quarterly: 91 }[e.target.value] || iv.days
                    const next = form.intervals.slice()
                    next[i] = { type: e.target.value, days }
                    setField({ intervals: next })
                  }}
                  style={styles.input}
                >
                  {['Daily', 'Weekly', 'Monthly', 'Quarterly'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Interval Value" required error={errors[`interval_${i}`]}>
                <input
                  type="number" min={1} max={366} value={iv.days}
                  onChange={(e) => {
                    const next = form.intervals.slice()
                    next[i] = { ...iv, days: Number(e.target.value) }
                    setField({ intervals: next })
                  }}
                  style={{ ...styles.input, borderColor: errors[`interval_${i}`] ? '#dc2626' : LINE }}
                />
                {!errors[`interval_${i}`] && (
                  <p style={{ fontSize: 10.5, color: MUTE, margin: '5px 0 0' }}>
                    Days between one round and the next. Enter a value between 1-366.
                  </p>
                )}
              </Field>
            </div>
          </div>
        ))}

        {/* Full width and below the intervals, where the product puts it on the
            edit screen. The create screen puts it in the card's header instead. */}
        <button
          onClick={() => setField({ intervals: [...form.intervals, { type: 'Weekly', days: 7 }] })}
          style={styles.addInterval}
        >
          <LocalIcon name="plus" size={14} color={SUB} /> Add Interval
        </button>

        <p style={{ margin: '11px 0 0', fontSize: 11, color: MUTE, lineHeight: 1.5 }}>
          The date already on this reminder is not moved by an edit. A changed interval takes
          effect from the next round created against it.
        </p>
      </FormCard>
    </Modal>
  )
}

/* ── small pieces ─────────────────────────────────────────────────────────── */

function SectionHead({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Glyph name={icon} size={16} color="#15227a" />
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: INK }}>{title}</h3>
    </div>
  )
}

function Labelled({ icon, label, children }) {
  return (
    <div style={{ minWidth: 0, marginBottom: 11 }}>
      <div style={styles.labelLine}>
        {icon && <Glyph name={icon} size={13} color={MUTE} />}
        {label}
      </div>
      <div style={{ fontSize: 13, color: INK, lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTE, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function KeyRow({ label, value }) {
  return (
    <div style={styles.keyRow}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: SUB }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: '#15227a' }}>{value}</span>
    </div>
  )
}

const styles = {
  columns: {
    display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 14, alignItems: 'start',
  },
  sheet: {
    background: '#fff', borderRadius: 12, padding: '17px 19px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  outlinePill: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
    fontSize: 11, fontWeight: 700, borderRadius: 999, color: SUB, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, whiteSpace: 'nowrap',
  },

  pairGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 },
  labelLine: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700,
    color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
  },
  dim: { color: SUB },
  code: { fontSize: 11, color: MUTE, marginTop: 3 },

  checklistFacts: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))',
    gap: 12, marginTop: 12,
  },

  analysis: {
    padding: '14px 16px', borderRadius: 11, background: '#f5f3ff', marginBottom: 11,
    borderLeftStyle: 'solid', borderLeftWidth: 4, borderLeftColor: '#7c3aed',
    borderTopStyle: 'solid', borderRightStyle: 'solid', borderBottomStyle: 'solid',
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#ddd6fe',
  },
  analysisPoint: {
    display: 'flex', gap: 9, margin: '0 0 8px', fontSize: 12.5, color: INK, lineHeight: 1.6,
  },
  analysisDot: {
    width: 6, height: 6, borderRadius: 999, background: '#a78bfa',
    marginTop: 7, flexShrink: 0,
  },

  genRow: {
    display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 9,
    background: '#fbfcfd', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  genNo: {
    width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center',
    background: '#e8ecff', color: '#15227a', fontSize: 11.5, fontWeight: 800, flexShrink: 0,
  },
  genSub: { display: 'block', fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.45 },
  eyeBtn: {
    width: 30, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center',
    background: '#15227a', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
  },

  intervalRow: {
    display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  dot: {
    width: 8, height: 8, borderRadius: 999, background: '#15227a',
    marginTop: 5, flexShrink: 0, display: 'block',
  },
  alert: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 9,
    background: '#fffbeb', color: '#b45309', fontSize: 12.5,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a',
  },

  keyRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },

  auditRow: {
    padding: '10px 12px', borderRadius: 9, marginBottom: 8,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  auditLine: { margin: 0, fontSize: 12, color: SUB },
  auditSub: { margin: '2px 0 0', fontSize: 11, color: MUTE },

  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
    gap: 12, marginBottom: 12, alignItems: 'start',
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: 12.5,
    fontFamily: 'inherit', lineHeight: 1.5, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  errorText: { margin: '5px 0 0', fontSize: 11.5, color: '#dc2626', lineHeight: 1.45 },
  assignmentBlock: {
    paddingTop: 13, marginBottom: 13,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },
  clearAssign: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
    fontSize: 11, fontWeight: 700, fontFamily: 'inherit', borderRadius: 7,
    background: 'transparent', color: SUB, border: 'none', cursor: 'pointer',
  },
  subjectAlert: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9,
    fontSize: 12.5, marginBottom: 11, background: '#fef2f2', color: '#b91c1c',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  intervalBlock: {
    padding: '12px 13px', borderRadius: 9, marginBottom: 9, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  addInterval: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    width: '100%', padding: '9px 13px', fontSize: 12.5, fontWeight: 700,
    fontFamily: 'inherit', borderRadius: 9, background: '#fff', color: SUB,
    cursor: 'pointer', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
}
