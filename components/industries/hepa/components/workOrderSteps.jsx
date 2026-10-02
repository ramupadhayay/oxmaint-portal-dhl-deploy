'use client'

// The nine section bodies of the Create Work Order form.
//
// One file rather than nine because they share every primitive and none of
// them is large on its own; splitting them would have meant nine files whose
// import block was longer than their body.
//
// Where the product reads a list from an org's own configuration — teams,
// vendors, departments — this form reads the workbook instead, and where the
// workbook holds nothing it shows the product's own empty option rather than
// filling the select with names nobody here uses.

import { useMemo } from 'react'
import { PALETTE, Priority } from '../lib/kit'
import { Glyph, BRAND } from '../lib/productKit'
import { Id, Penetration } from '../lib/ui'
import {
  FILTER_VIEW, CLEANROOMS, TECHNICIANS, USER, THRESHOLDS, DOCUMENT_RECORDS, fmtDate,
} from '../lib/data'
import { ORDER_TYPES, PRIORITIES } from '../lib/ops'
import {
  FormCard, Grid, Field, Input, Select, Textarea, Toggle, StepEmpty, RowCard,
  AddButton, RISK_LEVELS, REMARK_TYPES, COST_TYPES, LABOUR_CODES,
} from '../lib/workOrderForm'

const { INK, SUB, MUTE, LINE } = PALETTE
const icon = (name) => <Glyph name={name} size={17} color={BRAND[600]} />

/** The roles the certification documents are actually routed to. */
const DEPARTMENTS = [...new Set(DOCUMENT_RECORDS.map((d) => d.routedToRole).filter(Boolean))].sort()

// ── 1 · Basic Information ─────────────────────────────────────────────────

export function BasicStep({ form, set, errors, showErrors }) {
  const picked = FILTER_VIEW.find((f) => f.filterId === form.filterId) || null
  const err = (label) => (showErrors && errors.basic?.some((m) => m.startsWith(label)) ? errors.basic.find((m) => m.startsWith(label)) : null)

  // Filters something is wrong with first, then the rest — the same order the
  // register itself sorts in, so the one you came here to raise an order about
  // is at the top of the list rather than buried alphabetically.
  const assets = useMemo(() => [...FILTER_VIEW].sort((a, b) => {
    const rank = (f) => (f.concern === 'Failed integrity test' ? 0 : f.concern ? 1 : f.dueIn != null && f.dueIn < 0 ? 2 : 3)
    return rank(a) - rank(b) || (a.dueIn ?? 9999) - (b.dueIn ?? 9999)
  }), [])

  return (
    <>
      <FormCard title="Basic Information" icon={icon('clipboard')}
        right={(
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: MUTE }}>
            <Glyph name="sparkle" size={14} color={MUTE} />
            Ask Synapse fills the rest once an asset is picked
          </span>
        )}>
        <Field label="Work Order Title" required error={err('Work Order Title')}>
          <Input value={form.title} onChange={(e) => set({ title: e.target.value })}
            placeholder="Enter a descriptive title for the work order..." />
        </Field>

        <Grid style={{ marginTop: 14 }}>
          <Field label="Work Order Type" required error={err('Work Order Type')}>
            <Select value={form.workOrderType} onChange={(e) => set({ workOrderType: e.target.value })}>
              <option value="">Select work order type</option>
              {ORDER_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </Select>
          </Field>

          <Field label="Priority" required error={err('Priority')}>
            <Select value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="">Select priority level</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>

          <Field label="Related Asset" required error={err('Related Asset')}
            hint={picked ? `${picked.cleanroomName} · ${picked.isoClass} · installed ${fmtDate(picked.installedOn)}` : null}>
            <Select value={form.filterId} onChange={(e) => set({ filterId: e.target.value })}>
              <option value="">Select an asset from the list</option>
              {assets.map((f) => (
                <option key={f.filterId} value={f.filterId}>
                  {f.filterId} — {f.cleanroomName}{f.concern ? ` · ${f.concern}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Functional Location" dim={Boolean(form.filterId)}
            hint={form.filterId ? 'Taken from the asset. Clear the asset to pick a location instead.' : null}>
            <Select value={form.filterId ? picked?.cleanroomId || '' : form.functionalLocation}
              disabled={Boolean(form.filterId)}
              onChange={(e) => set({ functionalLocation: e.target.value })}>
              <option value="">Select a functional location</option>
              {CLEANROOMS.map((c) => <option key={c.cleanroomId} value={c.cleanroomId}>{c.cleanroomId} — {c.name}</option>)}
            </Select>
          </Field>
        </Grid>

        <Field label="Description" required error={err('Description')} >
          <Textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })}
            placeholder="Provide detailed description of the work to be performed..." style={{ marginTop: 0 }} />
        </Field>

        {picked?.concern && (
          <p style={styles.warn}>
            <strong style={{ color: '#7f1d1d' }}>{picked.concern}.</strong>{' '}
            {picked.lastTest?.result === 'Fail'
              ? <>Its last integrity test measured <Penetration value={picked.lastTest.penetration} /> against a maximum of {THRESHOLDS.penetration.value}.</>
              : `${picked.breachCount} pressure readings are over ${THRESHOLDS.pressureDifferential.value} in. wg.`}
          </p>
        )}
      </FormCard>

      <FormCard title="Assignment" icon={icon('user')}>
        <p style={styles.note}>
          <Glyph name="info" size={14} color={BRAND[600]} />
          You must assign this work order to an individual team member. You can optionally also assign it to a team.
        </p>
        <Grid cols={4} style={{ marginTop: 12 }}>
          <Field label="Assigned To (Individual)">
            <Select value={form.assignedTo} onChange={(e) => set({ assignedTo: e.target.value })}>
              <option value="">Select team member</option>
              {TECHNICIANS.map((t) => <option key={t.technicianId} value={t.name}>{t.name} ({t.technicianId})</option>)}
            </Select>
          </Field>
          <Field label="Assigned Team">
            <Select value="" disabled>
              <option value="">No team assignment</option>
            </Select>
          </Field>
          <Field label="Assigned Vendor">
            <Select value="" disabled>
              <option value="">No vendors on file</option>
            </Select>
          </Field>
          <Field label="Assigned Department" dim={Boolean(form.assignedTo)}
            hint={form.assignedTo ? 'Department selection is disabled when members or a team are assigned.' : null}>
            <Select value={form.assignedDepartment} disabled={Boolean(form.assignedTo)}
              onChange={(e) => set({ assignedDepartment: e.target.value })}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
        </Grid>
      </FormCard>

      <FormCard title="Scheduling" icon={icon('calendar')}>
        <Grid>
          <Field label="Requested Date">
            <Input type="date" value={form.requestedDate} onChange={(e) => set({ requestedDate: e.target.value })} />
          </Field>
          <Field label="Scheduled Start Date">
            <Input type="date" value={form.scheduledStart} onChange={(e) => set({ scheduledStart: e.target.value })} />
          </Field>
          <Field label="Scheduled End Date" error={showErrors ? errors.basic?.find((m) => m.startsWith('Scheduled End Date')) : null}>
            <Input type="date" value={form.scheduledEnd} onChange={(e) => set({ scheduledEnd: e.target.value })} />
          </Field>
          <Field label="Estimated Duration (hours)">
            <Input type="number" min="0" step="0.5" value={form.estimatedDuration}
              onChange={(e) => set({ estimatedDuration: e.target.value })} placeholder="0" />
          </Field>
        </Grid>
        <Grid style={{ marginTop: 14 }}>
          <Field label="Actual Start Date" hint="Filled in when the job is started.">
            <Input type="date" value={form.actualStart} onChange={(e) => set({ actualStart: e.target.value })} />
          </Field>
          <Field label="Actual End Date" hint="Filled in when the job is closed.">
            <Input type="date" value={form.actualEnd} onChange={(e) => set({ actualEnd: e.target.value })} />
          </Field>
        </Grid>
      </FormCard>

      <FormCard title="Shutdown Plan" icon={icon('clock')}>
        <Field label="Planned Shutdown"
          hint="A filter change takes the room off line. Say so here and the room's other work is planned around it.">
          <Select value={form.shutdown} onChange={(e) => set({ shutdown: e.target.value })}>
            <option value="">Select Shutdown</option>
            {CLEANROOMS.map((c) => (
              <option key={c.cleanroomId} value={c.cleanroomId}>{c.cleanroomId} — {c.name} off line</option>
            ))}
          </Select>
        </Field>
      </FormCard>
    </>
  )
}

// ── 2 · Task List ─────────────────────────────────────────────────────────

export function TasksStep({ form, set, errors, showErrors }) {
  const tasks = form.tasks || []
  const add = () => set({ tasks: [...tasks, { description: '', assignedTo: '', status: 'Pending', hours: '', labourCode: '', approval: false }] })
  const edit = (i, patch) => set({ tasks: tasks.map((t, n) => (n === i ? { ...t, ...patch } : t)) })
  const drop = (i) => set({ tasks: tasks.filter((_, n) => n !== i) })

  const hours = tasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0)

  return (
    <FormCard title="Task List" icon={icon('list')}
      right={(
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: MUTE }}>
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}{hours ? ` · Total: ${hours}h estimated` : ''}
          </span>
          <AddButton onClick={add}>Add Task</AddButton>
        </span>
      )}>
      {showErrors && errors.tasks?.length > 0 && (
        <p style={styles.warn}>{errors.tasks[0]}.</p>
      )}

      {tasks.length === 0 ? (
        <StepEmpty title="No tasks defined"
          description="Add tasks to break down the work order into manageable steps"
          action={<AddButton onClick={add}>Add Task</AddButton>} />
      ) : tasks.map((t, i) => (
        <RowCard key={i} index={i} title={t.description || 'Task description'} onRemove={() => drop(i)}>
          <Field label="Task Description" required>
            <Input value={t.description} onChange={(e) => edit(i, { description: e.target.value })}
              placeholder="Describe what needs to be done" />
          </Field>
          <Grid cols={4} style={{ marginTop: 12 }}>
            <Field label="Assigned To">
              <Select value={t.assignedTo} onChange={(e) => edit(i, { assignedTo: e.target.value })}>
                <option value="">Unassigned</option>
                {TECHNICIANS.map((x) => <option key={x.technicianId} value={x.name}>{x.name}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={t.status} onChange={(e) => edit(i, { status: e.target.value })}>
                {['Pending', 'In Progress', 'Completed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Duration (hours)">
              <Input type="number" min="0" step="0.5" value={t.hours} onChange={(e) => edit(i, { hours: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Laborer Code">
              <Select value={t.labourCode} onChange={(e) => edit(i, { labourCode: e.target.value })}>
                <option value="">No laborer code</option>
                {LABOUR_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Select>
            </Field>
          </Grid>
          <div style={{ marginTop: 12 }}>
            <Toggle label="Requires Approval" description="A reviewer signs this task off before the order can close"
              checked={t.approval} onChange={(v) => edit(i, { approval: v })} />
          </div>
        </RowCard>
      ))}
    </FormCard>
  )
}

// ── 3 · Advanced Details ──────────────────────────────────────────────────

export function AdvancedStep({ form, set }) {
  return (
    <>
      <FormCard title="Problem Description & Analysis" icon={icon('doc')}>
        <Field label="Problem Description">
          <Textarea rows={4} value={form.problem} onChange={(e) => set({ problem: e.target.value })}
            placeholder="Describe the problem or issue that requires attention. Be as specific as possible about symptoms, observations, and any relevant details..." />
        </Field>
        <p style={styles.note}>
          <Glyph name="bulb" size={14} color={BRAND[600]} />
          <span>
            <strong style={{ color: SUB }}>Tip:</strong> Include any error codes, unusual sounds, visual
            observations, performance issues, or safety concerns. The more detailed the description, the
            better the technician can prepare for the work.
          </span>
        </p>
      </FormCard>

      <FormCard title="Safety & Compliance" icon={icon('shield')}>
        <Field label="EHS Risk Level"
          hint="Select the appropriate Environmental, Health & Safety risk level for this work">
          <Select value={form.riskLevel} onChange={(e) => set({ riskLevel: e.target.value })}>
            {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Safety Requirements & Precautions">
          <Textarea rows={3} value={form.safety} onChange={(e) => set({ safety: e.target.value })}
            placeholder="List specific safety requirements, PPE needed, lockout/tagout procedures, confined space requirements, hot work permits, etc..." />
        </Field>
        <Grid style={{ marginTop: 14 }}>
          <Toggle label="Requires Approval" description="Management or supervisor approval needed"
            checked={form.requiresApproval} onChange={(v) => set({ requiresApproval: v })} />
          <Toggle label="Requires Permits" description="Work permits or special authorizations"
            checked={form.requiresPermits} onChange={(v) => set({ requiresPermits: v })} />
          <Toggle label="Shutdown Work" description="Requires equipment or system shutdown"
            checked={form.shutdownWork} onChange={(v) => set({ shutdownWork: v })} />
          <Toggle label="Lubrication Work" description="Routine lubrication or grease work"
            checked={form.lubrication} onChange={(v) => set({ lubrication: v })} />
        </Grid>

        {(form.riskLevel === 'Critical' || form.riskLevel === 'High' || form.requiresPermits) && (
          <div style={styles.risk}>
            <strong style={{ color: '#7f1d1d', fontSize: 12 }}>High-risk work identified:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11.5, color: SUB, lineHeight: 1.65 }}>
              {form.requiresApproval && <li>Approval workflow will be initiated</li>}
              {form.requiresPermits && <li>Work permits must be obtained before starting</li>}
              {form.riskLevel && <li>{form.riskLevel} risk level requires enhanced safety protocols</li>}
            </ul>
          </div>
        )}
      </FormCard>

      <FormCard title="Additional Requirements" icon={icon('check')}>
        <Grid>
          <Toggle label="Photos Required" description="Photo documentation before/after work"
            checked={form.photosRequired} onChange={(v) => set({ photosRequired: v })} />
          <Toggle label="Signature Required" description="Digital signature upon completion"
            checked={form.signatureRequired} onChange={(v) => set({ signatureRequired: v })} />
          <Toggle label="Requires Inspection" description="Post-completion inspection needed"
            checked={form.requiresInspection} onChange={(v) => set({ requiresInspection: v })} />
          <Toggle label="Mobile Work Order" description="Accessible via mobile devices"
            checked={form.mobile} onChange={(v) => set({ mobile: v })} />
        </Grid>
        <Field label="Budget Code (Optional)" hint="Specify the budget code this work is charged against">
          <Input value={form.budgetCode} onChange={(e) => set({ budgetCode: e.target.value })}
            placeholder="Enter budget code for cost tracking" />
        </Field>
      </FormCard>
    </>
  )
}

// ── 4 · Parts & Materials ─────────────────────────────────────────────────

export function PartsStep({ form, set }) {
  const parts = form.parts || []
  const add = () => set({ parts: [...parts, { name: '', quantity: '1', unitCost: '', location: '', supplier: '', notes: '', critical: false }] })
  const edit = (i, patch) => set({ parts: parts.map((p, n) => (n === i ? { ...p, ...patch } : p)) })
  const drop = (i) => set({ parts: parts.filter((_, n) => n !== i) })
  const total = parts.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unitCost) || 0), 0)

  return (
    <FormCard title="Parts & Materials" icon={icon('box')}
      right={(
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: MUTE }}>
            {parts.length} {parts.length === 1 ? 'part' : 'parts'}{total ? ` · Estimated: $${total.toFixed(2)}` : ''}
          </span>
          <AddButton onClick={add}>Add Material</AddButton>
        </span>
      )}>
      {parts.length === 0 ? (
        <StepEmpty title="No parts defined"
          description="Add parts and materials required for this work order from inventory"
          action={<AddButton onClick={add}>Add Part</AddButton>} />
      ) : parts.map((p, i) => (
        <RowCard key={i} index={i} title={p.name || 'Part name'} onRemove={() => drop(i)}>
          <Grid cols={4}>
            <Field label="Part Name" required>
              <Input value={p.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder="Enter part name" />
            </Field>
            <Field label="Required Quantity">
              <Input type="number" min="0" value={p.quantity} onChange={(e) => edit(i, { quantity: e.target.value })} />
            </Field>
            <Field label="Unit Cost ($)">
              <Input type="number" min="0" step="0.01" value={p.unitCost}
                onChange={(e) => edit(i, { unitCost: e.target.value })} placeholder="Standard cost" />
            </Field>
            <Field label="Storage Location">
              <Input value={p.location} onChange={(e) => edit(i, { location: e.target.value })} placeholder="Storage location" />
            </Field>
          </Grid>
          <Grid style={{ marginTop: 12 }}>
            <Field label="Supplier">
              <Input value={p.supplier} onChange={(e) => edit(i, { supplier: e.target.value })} placeholder="Enter supplier name" />
            </Field>
            <Field label="Notes">
              <Input value={p.notes} onChange={(e) => edit(i, { notes: e.target.value })} placeholder="Additional notes (optional)" />
            </Field>
          </Grid>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <Toggle label="Critical part" description="Mark as critical part to prioritise procurement"
                checked={p.critical} onChange={(v) => edit(i, { critical: v })} />
            </div>
            <span style={{ fontSize: 11.5, color: MUTE }}>
              Line Total: ${((Number(p.quantity) || 0) * (Number(p.unitCost) || 0)).toFixed(2)}
            </span>
          </div>
        </RowCard>
      ))}
    </FormCard>
  )
}

// ── 5 · Attachments ───────────────────────────────────────────────────────

export function AttachmentsStep({ form, set }) {
  const files = form.attachments || []
  const drop = (i) => set({ attachments: files.filter((_, n) => n !== i) })

  const take = (list) => {
    const added = [...list].map((f) => ({ name: f.name, size: f.size, type: f.type || 'file' }))
    set({ attachments: [...files, ...added.filter((a) => !files.some((f) => f.name === a.name))] })
  }

  const size = files.reduce((s, f) => s + (f.size || 0), 0)

  return (
    <FormCard title="Attachments" icon={icon('paperclip')}
      right={(
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: MUTE }}>
          {files.length} {files.length === 1 ? 'file' : 'files'}{size ? ` · Size: ${(size / 1024).toFixed(0)} KB` : ''}
        </span>
      )}>
      <label style={styles.drop}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files) }}>
        <Glyph name="paperclip" size={22} color={MUTE} />
        <span style={{ fontSize: 13, fontWeight: 700, color: SUB, marginTop: 8 }}>
          Drag and drop files here, or click to browse
        </span>
        <span style={{ fontSize: 11.5, color: MUTE, marginTop: 4 }}>
          Supports PDF, Images, Documents, Spreadsheets, Videos, Audio (max 10MB each)
        </span>
        <input type="file" multiple style={{ display: 'none' }}
          onChange={(e) => { take(e.target.files); e.target.value = '' }} />
      </label>

      {files.length === 0 ? (
        <div style={{ marginTop: 12 }}>
          <StepEmpty title="No attachments"
            description="Add supporting documents, images, or files for this work order" />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={f.name} style={styles.fileRow}>
              <Glyph name="doc" size={15} color={MUTE} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: INK, minWidth: 0, overflowWrap: 'anywhere' }}>{f.name}</span>
              <span style={{ fontSize: 11, color: MUTE, marginLeft: 'auto', flexShrink: 0 }}>
                {f.size ? `${(f.size / 1024).toFixed(0)} KB` : ''}
              </span>
              <button type="button" onClick={() => drop(i)} style={styles.removeSmall}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <p style={styles.note}>
        <Glyph name="bulb" size={14} color={BRAND[600]} />
        <span>
          <strong style={{ color: SUB }}>Tip:</strong> Include photos of the problem, technical drawings,
          manuals, or any supporting documentation that will help technicians complete the work efficiently.
        </span>
      </p>
    </FormCard>
  )
}

// ── 6 · Labour & Resources ────────────────────────────────────────────────

export function LabourStep({ form, set }) {
  const labour = form.labour || []
  const tasks = form.tasks || []
  const add = () => set({ labour: [...labour, { name: '', code: '', workers: '1', hours: '', rate: '', breakMin: '', task: '' }] })
  const edit = (i, patch) => set({ labour: labour.map((l, n) => (n === i ? { ...l, ...patch } : l)) })
  const drop = (i) => set({ labour: labour.filter((_, n) => n !== i) })

  const lineCost = (l) => (Number(l.workers) || 0) * (Number(l.hours) || 0) * (Number(l.rate) || 0)
  const hours = labour.reduce((s, l) => s + (Number(l.workers) || 0) * (Number(l.hours) || 0), 0)
  const cost = labour.reduce((s, l) => s + lineCost(l), 0)

  return (
    <FormCard title="Labour & Resources" icon={icon('user')}
      right={(
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: MUTE }}>
            {labour.length} {labour.length === 1 ? 'assignment' : 'assignments'}
            {hours ? ` · Total: ${hours}h` : ''}{cost ? ` · Cost: $${cost.toFixed(2)}` : ''}
          </span>
          <AddButton onClick={add}>Add Labour</AddButton>
        </span>
      )}>
      {labour.length === 0 ? (
        <StepEmpty title="No labour assigned"
          description="Assign the trades and hours this order is expected to take"
          action={<AddButton onClick={add}>Add Labour Assignment</AddButton>} />
      ) : labour.map((l, i) => (
        <RowCard key={i} index={i} title={l.name || 'Laborer name'} onRemove={() => drop(i)}>
          <Grid cols={4}>
            <Field label="Laborer Name" required>
              <Select value={l.name} onChange={(e) => edit(i, { name: e.target.value })}>
                <option value="">Enter laborer name</option>
                {TECHNICIANS.map((t) => <option key={t.technicianId} value={t.name}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Laborer Code" required>
              <Select value={l.code} onChange={(e) => edit(i, { code: e.target.value })}>
                <option value="">Select laborer code</option>
                {LABOUR_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Select>
            </Field>
            <Field label="No. of Workers">
              <Input type="number" min="1" value={l.workers} onChange={(e) => edit(i, { workers: e.target.value })} />
            </Field>
            <Field label="Expected hour worked">
              <Input type="number" min="0" step="0.5" value={l.hours} onChange={(e) => edit(i, { hours: e.target.value })} placeholder="0" />
            </Field>
          </Grid>
          <Grid cols={4} style={{ marginTop: 12 }}>
            <Field label="Hourly Rate ($)">
              <Input type="number" min="0" step="0.01" value={l.rate} onChange={(e) => edit(i, { rate: e.target.value })} placeholder="0.00" />
            </Field>
            <Field label="Break Duration (min)">
              <Input type="number" min="0" value={l.breakMin} onChange={(e) => edit(i, { breakMin: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Assign to Task"
              hint={tasks.length ? null : 'Add tasks in the Task List section first'}>
              <Select value={l.task} disabled={!tasks.length} onChange={(e) => edit(i, { task: e.target.value })}>
                <option value="">Select a task (optional)</option>
                {tasks.map((t, n) => (
                  <option key={n} value={String(n)}>Task {n + 1} — {t.description || 'untitled'}</option>
                ))}
              </Select>
            </Field>
            <Field label="Total Cost">
              <Input value={`$${lineCost(l).toFixed(2)}`} readOnly style={{ background: '#f8fafc', color: SUB }} />
            </Field>
          </Grid>
        </RowCard>
      ))}
    </FormCard>
  )
}

// ── 7 · Remarks & Notes ───────────────────────────────────────────────────

export function RemarksStep({ form, set }) {
  const remarks = form.remarks || []
  const add = () => set({ remarks: [...remarks, { type: 'General', text: '', by: USER.name }] })
  const edit = (i, patch) => set({ remarks: remarks.map((r, n) => (n === i ? { ...r, ...patch } : r)) })
  const drop = (i) => set({ remarks: remarks.filter((_, n) => n !== i) })

  return (
    <FormCard title="Remarks & Notes" icon={icon('message')}
      right={(
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: MUTE }}>
            {remarks.length} {remarks.length === 1 ? 'remark' : 'remarks'}
          </span>
          <AddButton onClick={add}>Add Remark</AddButton>
        </span>
      )}>
      {remarks.length === 0 ? (
        <StepEmpty title="No remarks added"
          description="Add notes, observations, or important information about this work order"
          action={<AddButton onClick={add}>Add Remark</AddButton>} />
      ) : remarks.map((r, i) => (
        <RowCard key={i} index={i} title={r.text?.slice(0, 60) || 'Remark text'} onRemove={() => drop(i)}>
          <Grid>
            <Field label="Remark Type">
              <Select value={r.type} onChange={(e) => edit(i, { type: e.target.value })}>
                {REMARK_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Created By">
              <Input value={r.by} onChange={(e) => edit(i, { by: e.target.value })} placeholder="Enter your name" />
            </Field>
          </Grid>
          <Field label="Remark Text" hint={`${(r.text || '').length}/500 characters — be specific and include relevant details`}>
            <Textarea rows={3} maxLength={500} value={r.text} onChange={(e) => edit(i, { text: e.target.value })}
              placeholder="Enter your remark, observation, or note about this work order..." />
          </Field>
        </RowCard>
      ))}
    </FormCard>
  )
}

// ── 8 · Costs & Budget ────────────────────────────────────────────────────

export function CostsStep({ form, set }) {
  const costs = form.costs || []
  const add = () => set({ costs: [...costs, { type: 'Equipment', description: '', amount: '', billable: false, approval: false }] })
  const edit = (i, patch) => set({ costs: costs.map((c, n) => (n === i ? { ...c, ...patch } : c)) })
  const drop = (i) => set({ costs: costs.filter((_, n) => n !== i) })

  const labourCost = (form.labour || []).reduce((s, l) => s + (Number(l.workers) || 0) * (Number(l.hours) || 0) * (Number(l.rate) || 0), 0)
  const materialCost = (form.parts || []).reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unitCost) || 0), 0)
  const additional = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0)

  return (
    <>
      <div style={styles.costRow}>
        <CostTile label="Labour Costs" what="From labour assignments" value={labourCost} />
        <CostTile label="Material Costs" what="From parts & materials" value={materialCost} />
        <CostTile label="Additional Costs" what={`${costs.length} additional cost`} value={additional} />
        <CostTile label="Total Work Order Cost" what="Labour, materials and additional"
          value={labourCost + materialCost + additional} strong />
      </div>

      <FormCard title="Costs & Budget" icon={icon('coins')}
        right={<span style={{ marginLeft: 'auto' }}><AddButton onClick={add}>Add Cost</AddButton></span>}>
        {costs.length === 0 ? (
          <StepEmpty title="No additional costs"
            description="Add equipment, service, or other costs beyond labour and materials"
            action={<AddButton onClick={add}>Add Cost</AddButton>} />
        ) : costs.map((c, i) => (
          <RowCard key={i} index={i} title={c.description || 'Cost item'} onRemove={() => drop(i)}>
            <Grid>
              <Field label="Cost Type">
                <Select value={c.type} onChange={(e) => edit(i, { type: e.target.value })}>
                  {COST_TYPES.map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Estimated Cost ($)">
                <Input type="number" min="0" step="0.01" value={c.amount}
                  onChange={(e) => edit(i, { amount: e.target.value })} placeholder="0.00" />
              </Field>
            </Grid>
            <Field label="Description">
              <Input value={c.description} onChange={(e) => edit(i, { description: e.target.value })}
                placeholder="Detailed cost description..." />
            </Field>
            <Grid style={{ marginTop: 12 }}>
              <Toggle label="Billable to customer" description="Recharged rather than absorbed"
                checked={c.billable} onChange={(v) => edit(i, { billable: v })} />
              <Toggle label="Requires approval" description="A reviewer signs this cost off"
                checked={c.approval} onChange={(v) => edit(i, { approval: v })} />
            </Grid>
          </RowCard>
        ))}
      </FormCard>
    </>
  )
}

function CostTile({ label, what, value, strong }) {
  return (
    <div style={{ ...styles.costTile, borderColor: strong ? '#c7d2fe' : LINE, background: strong ? '#f6f7fd' : '#fff' }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: SUB }}>{label}</span>
      <span style={{ fontSize: 21, fontWeight: 800, color: INK, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
        ${value.toFixed(2)}
      </span>
      <span style={{ fontSize: 11, color: MUTE, marginTop: 3 }}>{what}</span>
    </div>
  )
}

// ── 9 · Review & Submit ───────────────────────────────────────────────────

export function ReviewStep({ form, errors, orderNumber, onGoTo }) {
  const picked = FILTER_VIEW.find((f) => f.filterId === form.filterId) || null
  const type = ORDER_TYPES.find((t) => t.code === form.workOrderType)
  const outstanding = Object.entries(errors)
  const hours = (form.tasks || []).reduce((s, t) => s + (Number(t.hours) || 0), 0)

  return (
    <>
      {outstanding.length > 0 && (
        <div style={styles.errorCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Glyph name="warning" size={15} color="#b45309" />
            <strong style={{ fontSize: 13, color: '#b45309' }}>
              Complete Information Required ({outstanding.reduce((s, [, v]) => s + v.length, 0)})
            </strong>
          </div>
          {outstanding.map(([key, list]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <button type="button" onClick={() => onGoTo(key)} style={styles.errorLink}>
                {STEP_TITLE[key]} — {list.length} field{list.length === 1 ? '' : 's'}
              </button>
              <ul style={{ margin: '5px 0 0', paddingLeft: 18, fontSize: 11.5, color: '#92400e', lineHeight: 1.6 }}>
                {list.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      <FormCard title="Work Order Summary" icon={icon('doc')}>
        <Grid>
          <div>
            <Head>Basic Information</Head>
            <Line k="Order" v={orderNumber} mono />
            <Line k="Title" v={form.title} />
            <Line k="Priority" v={form.priority ? <Priority value={form.priority} /> : null} />
            <Line k="Type" v={type?.label} />
            <Line k="Asset" v={picked ? <Id strong>{picked.filterId}</Id> : null} />
            <Line k="Location" v={picked ? `${picked.cleanroomName} (${picked.isoClass})` : form.functionalLocation} />
            <Line k="Last test" v={picked?.lastTest ? `${picked.lastTest.result} · ${fmtDate(picked.lastTest.date)}` : null} />

            <Head style={{ marginTop: 16 }}>Assignment</Head>
            <Line k="Assigned to" v={form.assignedTo} empty="Not assigned" />
            <Line k="Assigned department" v={form.assignedDepartment} empty="Not assigned" />
            <Line k="Raised by" v={USER.name} />
          </div>

          <div>
            <Head>Scheduling</Head>
            <Line k="Requested" v={form.requestedDate && fmtDate(form.requestedDate)} />
            <Line k="Scheduled start" v={form.scheduledStart && fmtDate(form.scheduledStart)} />
            <Line k="Scheduled end" v={form.scheduledEnd && fmtDate(form.scheduledEnd)} />
            <Line k="Estimated duration" v={form.estimatedDuration ? `${form.estimatedDuration} h` : null} />
            <Line k="Planned shutdown" v={form.shutdown} empty="None" />

            <Head style={{ marginTop: 16 }}>Sections</Head>
            <Line k="Tasks" v={`${(form.tasks || []).length}${hours ? ` · ${hours}h estimated` : ''}`} />
            <Line k="Parts & materials" v={String((form.parts || []).length)} />
            <Line k="Attachments" v={String((form.attachments || []).length)} />
            <Line k="Labour" v={String((form.labour || []).length)} />
            <Line k="Remarks" v={String((form.remarks || []).length)} />
            <Line k="Additional costs" v={String((form.costs || []).length)} />
          </div>
        </Grid>

        {form.description && (
          <>
            <Head style={{ marginTop: 16 }}>Description</Head>
            <p style={styles.body}>{form.description}</p>
          </>
        )}
        {form.problem && (
          <>
            <Head style={{ marginTop: 14 }}>Problem Description</Head>
            <p style={styles.body}>{form.problem}</p>
          </>
        )}
        {form.safety && (
          <>
            <Head style={{ marginTop: 14 }}>Safety Requirements</Head>
            <p style={styles.body}>{form.safety}</p>
          </>
        )}

        {(form.tasks || []).length > 0 && (
          <>
            <Head style={{ marginTop: 16 }}>Tasks</Head>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: SUB, lineHeight: 1.75 }}>
              {form.tasks.map((t, i) => (
                <li key={i}>
                  {t.description || 'Untitled task'}
                  {t.hours ? ` — ${t.hours}h` : ''}
                  {t.assignedTo ? ` · ${t.assignedTo}` : ''}
                  {t.approval ? ' · Approval Required' : ''}
                </li>
              ))}
            </ol>
          </>
        )}

        <p style={styles.provenance}>
          Raised here it is marked as not yet sent to SAP — nothing pretends it came from their
          order register. It is saved to the record store, so it survives a reload and appears on
          the register beside the imported orders.
        </p>
      </FormCard>
    </>
  )
}

const STEP_TITLE = {
  basic: 'Basic Information', tasks: 'Task List', advanced: 'Advanced Details',
  parts: 'Parts & Materials', attachments: 'Attachments', labour: 'Labour & Resources',
  remarks: 'Remarks & Notes', costs: 'Costs & Budget', review: 'Review & Submit',
}

function Head({ children, style }) {
  return (
    <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: SUB, ...style }}>{children}</h4>
  )
}

function Line({ k, v, mono, empty = 'Not specified' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 0', fontSize: 12.5 }}>
      <span style={{ color: MUTE, flexShrink: 0 }}>{k}</span>
      <span style={{
        marginLeft: 'auto', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere',
        fontWeight: 600, color: v ? INK : MUTE,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
      }}>{v || empty}</span>
    </div>
  )
}

const styles = {
  note: {
    display: 'flex', alignItems: 'flex-start', gap: 8, margin: '13px 0 0',
    padding: '10px 12px', borderRadius: 9, background: BRAND[50],
    fontSize: 11.5, color: SUB, lineHeight: 1.55,
    borderStyle: 'solid', borderWidth: 1, borderColor: BRAND[100],
  },
  warn: {
    margin: '0 0 13px', padding: '10px 12px', borderRadius: 9,
    background: '#fef2f2', fontSize: 11.5, color: SUB, lineHeight: 1.55,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  risk: {
    marginTop: 13, padding: '11px 13px', borderRadius: 9, background: '#fef2f2',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  drop: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '30px 20px', borderRadius: 11, cursor: 'pointer', textAlign: 'center',
    borderStyle: 'dashed', borderWidth: 2, borderColor: LINE, background: '#fcfdfe',
  },
  fileRow: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', marginBottom: 7,
    borderRadius: 9, background: '#fcfdfe',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  removeSmall: {
    flexShrink: 0, padding: '3px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
    color: '#b91c1c', background: '#fff', cursor: 'pointer',
    borderRadius: 6, borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  costRow: {
    display: 'grid', gap: 12, marginBottom: 14,
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  },
  costTile: {
    display: 'flex', flexDirection: 'column', padding: '14px 16px', borderRadius: 11,
    borderStyle: 'solid', borderWidth: 1,
  },
  errorCard: {
    padding: '14px 16px', borderRadius: 11, marginBottom: 14, background: '#fffbeb',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a',
  },
  errorLink: {
    padding: 0, fontSize: 12, fontWeight: 800, fontFamily: 'inherit', color: '#b45309',
    background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
  },
  body: {
    margin: 0, padding: '10px 12px', borderRadius: 9, background: '#f8fafc',
    fontSize: 12.5, color: SUB, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
  },
  provenance: {
    margin: '16px 0 0', paddingTop: 13, borderTop: `1px solid ${LINE}`,
    fontSize: 11.5, color: MUTE, lineHeight: 1.6,
  },
}
