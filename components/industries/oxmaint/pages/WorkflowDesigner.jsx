'use client'

// Workflow Designer — the automation rules, shown as rules rather than as a
// canvas.
//
// The obvious thing to build here is a drag-and-drop node graph. It would look
// impressive and say nothing: what a maintenance manager needs to know is which
// automations are running, what fires them, and what they have done lately. A
// rule reads as "when X, if Y, then Z", so that is how each one is laid out,
// with its recent firing count beside it as the evidence it is actually on.
//
// The builder follows the same shape for the same reason. A canvas teaches
// nobody what their automation does; a sentence is what somebody has to be able
// to check at a glance six months later.
//
// Pausing a rule is a write, not screen state. A rule switched off that comes
// back on when the page reloads is worse than one that cannot be switched off at
// all — the second is a missing feature, the first is a lie about the system.

import { useState } from 'react'
import {
  PageHeader, StatStrip, Card, Section, StatusBadge, ActionButton, Drawer, Fields,
  Modal, PALETTE,
} from '../lib/kit'
import { sectionIcon } from '../lib/nav'
import { useRecords, useStore } from '../lib/store'
import { between, pick, daysFrom, fmtDate, TECHNICIANS, USER } from '../lib/data'

const { MUTE, SUB, INK, LINE, ACCENT, GREEN, AMBER } = PALETTE

const RULES = [
  {
    workflow_id: 'wf_01', name: 'Escalate critical work orders',
    trigger: 'Work order raised', status: 'Active',
    conditions: ['Priority is Critical', 'Asset criticality is High'],
    actions: ['Notify the maintenance supervisor', 'Set due date to 24 hours', 'Post to the Teams channel'],
  },
  {
    workflow_id: 'wf_02', name: 'Chase overdue preventive maintenance',
    trigger: 'PM schedule passes its due date', status: 'Active',
    conditions: ['Overdue by more than 3 days'],
    actions: ['Email the assigned technician', 'Raise a corrective work order', 'Flag on the compliance dashboard'],
  },
  {
    workflow_id: 'wf_03', name: 'Reorder below minimum',
    trigger: 'Stock movement recorded', status: 'Active',
    conditions: ['Quantity on hand falls below the reorder point'],
    actions: ['Create a demand part line', 'Draft a purchase order to the preferred vendor'],
  },
  {
    workflow_id: 'wf_04', name: 'Failed inspection becomes work',
    trigger: 'Inspection submitted', status: 'Active',
    conditions: ['Result is Fail', 'One or more findings recorded'],
    actions: ['Raise a corrective work order per finding', 'Assign to the asset owner'],
  },
  {
    workflow_id: 'wf_05', name: 'Permit expiry warning',
    trigger: 'Nightly check', status: 'Active',
    conditions: ['Permit is Active', 'Valid-to is within 4 hours'],
    actions: ['Notify the permit holder and approver'],
  },
  {
    workflow_id: 'wf_06', name: 'Certificate renewal',
    trigger: 'Nightly check', status: 'Active',
    conditions: ['Statutory certificate expires within 30 days'],
    actions: ['Notify the compliance owner', 'Raise an inspection'],
  },
  {
    workflow_id: 'wf_07', name: 'Purchase approval routing',
    trigger: 'Purchase order raised', status: 'Paused',
    conditions: ['Value above $5,000'],
    actions: ['Route to the finance approver', 'Hold until approved'],
  },
  {
    workflow_id: 'wf_08', name: 'Idle asset review',
    trigger: 'Monthly', status: 'Draft',
    conditions: ['No work order in 180 days', 'Asset is Operational'],
    actions: ['Add to the reliability review list'],
  },
].map((r, i) => ({
  ...r,
  runs_30d: r.status === 'Active' ? between(`wf${i}runs`, 4, 180) : 0,
  last_run: r.status === 'Active' ? daysFrom(-between(`wf${i}last`, 0, 6)) : null,
  owner_name: pick(`wf${i}own`, TECHNICIANS).name,
}))

// What a rule can fire on. These are events the portal actually has screens for
// — a trigger nothing raises is a rule that can never run, and offering one is
// how a builder fills up with automations that do nothing.
const TRIGGERS = [
  'Work order raised',
  'Work order completed',
  'Maintenance request submitted',
  'PM schedule passes its due date',
  'Inspection submitted',
  'Incident reported',
  'Stock movement recorded',
  'Purchase order raised',
  'Nightly check',
  'Monthly',
]

// Suggestions per trigger, so the second field knows what the first one made
// available: "Result is Fail" means nothing on a stock movement. Free text is
// still accepted — the list is a shortcut, not a fence.
const CONDITIONS = {
  'Work order raised': ['Priority is Critical', 'Priority is High', 'Asset criticality is High', 'No technician assigned'],
  'Work order completed': ['Actual hours exceed the estimate', 'Cost above $1,000', 'Recorded as rework'],
  'Maintenance request submitted': ['Raised by a site operator', 'Marked urgent', 'Asset is Down'],
  'PM schedule passes its due date': ['Overdue by more than 3 days', 'Overdue by more than 7 days', 'Asset criticality is High'],
  'Inspection submitted': ['Result is Fail', 'One or more findings recorded', 'Score below 70'],
  'Incident reported': ['Severity is Critical', 'Lost time recorded', 'Reportable to the regulator'],
  'Stock movement recorded': ['Quantity on hand falls below the reorder point', 'Part is a critical spare'],
  'Purchase order raised': ['Value above $5,000', 'Vendor is not approved'],
  'Nightly check': ['Permit is Active', 'Valid-to is within 4 hours', 'Statutory certificate expires within 30 days'],
  Monthly: ['No work order in 180 days', 'Asset is Operational'],
}

const ACTIONS = [
  'Notify the maintenance supervisor',
  'Notify the assigned technician',
  'Notify the compliance owner',
  'Raise a corrective work order',
  'Raise an inspection',
  'Create a demand part line',
  'Draft a purchase order to the preferred vendor',
  'Set due date to 24 hours',
  'Assign to the asset owner',
  'Route to the finance approver',
  'Hold until approved',
  'Flag on the compliance dashboard',
  'Post to the Teams channel',
  'Add to the reliability review list',
]

const idOf = (r) => r.workflow_id || r.recordId

export default function WorkflowDesigner() {
  const store = useStore()
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)

  // Seeded rules with any stored change applied, and rules built here on top.
  const rules = useRecords('workflow', RULES, idOf)

  const toggle = async (r) => {
    const next = r.status === 'Active' ? 'Paused' : 'Active'
    // The whole record, not just the flag: `update` writes the `data` object
    // wholesale, so a status flip that dropped the rest would blank the card on
    // the next read.
    await store.update('workflow', idOf(r), { ...r, status: next })
    store.notify(`${r.name} ${next === 'Active' ? 'activated' : 'paused'}.`)
  }

  const create = async (draft) => {
    const saved = await store.create('workflow', {
      ...draft,
      runs_30d: 0,
      last_run: null,
      owner_name: draft.owner_name || USER.name,
    })
    if (!saved) return
    store.notify(`${draft.name} created${draft.status === 'Active' ? ' and running' : ' as a draft'}.`)
    setCreating(false)
  }

  const active = rules.filter((r) => r.status === 'Active')

  return (
    <div>
      <PageHeader
        icon={sectionIcon('workflow-designer', ACCENT)}
        title="Workflow Designer"
        subtitle="Automations that run without anyone opening the product"
        right={<ActionButton onClick={() => setCreating(true)}>New workflow</ActionButton>}
      />

      <StatStrip items={[
        { label: 'Workflows', value: rules.length },
        { label: 'Active', value: active.length, tone: 'green' },
        { label: 'Paused', value: rules.filter((r) => r.status === 'Paused').length, tone: 'amber' },
        { label: 'Draft', value: rules.filter((r) => r.status === 'Draft').length },
        { label: 'Runs in 30 days', value: rules.reduce((n, r) => n + (r.runs_30d || 0), 0) },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(400px, 100%),1fr))', gap: 12 }}>
        {rules.map((r) => (
          <Card key={idOf(r)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button onClick={() => setOpen(r)} style={nameBtn}>{r.name}</button>
                <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>
                  Owner {r.owner_name}
                  {r.last_run ? ` · last ran ${fmtDate(r.last_run)}` : ' · never run'}
                </div>
              </div>
              <StatusBadge>{r.status}</StatusBadge>
            </div>

            <Step label="When" tone={ACCENT}>{r.trigger}</Step>
            {(r.conditions || []).map((c) => <Step key={c} label="If" tone={AMBER}>{c}</Step>)}
            {(r.actions || []).map((a) => <Step key={a} label="Then" tone={GREEN}>{a}</Step>)}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
              <span style={{ fontSize: 11.5, color: SUB }}>
                {r.runs_30d ? `${r.runs_30d} runs in the last 30 days` : 'Not running'}
              </span>
              <div style={{ marginLeft: 'auto' }}>
                {/* A draft can be activated — that is the only thing you ever
                    want to do with one, and it was the one state the button
                    refused to act on. */}
                <ActionButton size="sm" variant={r.status === 'Active' ? 'ghost' : 'subtle'}
                  onClick={() => toggle(r)}>
                  {r.status === 'Active' ? 'Pause' : 'Activate'}
                </ActionButton>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name} subtitle={open?.trigger}
        icon={sectionIcon('workflow-designer', ACCENT)}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <StatusBadge>{open.status}</StatusBadge>
            <Fields rows={[
              ['Trigger', open.trigger],
              ['Owner', open.owner_name],
              ['Runs (30 days)', open.runs_30d || 0],
              ['Last run', open.last_run ? fmtDate(open.last_run) : 'Never'],
            ]} />
            <Section title="Conditions" style={{ margin: 0 }}>
              {(open.conditions || []).length
                ? open.conditions.map((c) => <div key={c} style={rowLine}>{c}</div>)
                : <div style={{ ...rowLine, color: MUTE }}>None — it fires on every event.</div>}
            </Section>
            <Section title="Actions" style={{ margin: 0 }}>
              {(open.actions || []).map((a) => <div key={a} style={rowLine}>{a}</div>)}
            </Section>
          </div>
        )}
      </Drawer>

      <NewWorkflow open={creating} onClose={() => setCreating(false)} onCreate={create} />
    </div>
  )
}

/**
 * Build a rule.
 *
 * A trigger is required before conditions can be chosen, because the conditions
 * available depend on it. And a rule with no action is not saved: it would fire
 * correctly forever and do nothing, which is the hardest kind of broken
 * automation to notice.
 */
function NewWorkflow({ open, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [conditions, setConditions] = useState([])
  const [chosen, setChosen] = useState([])
  const [owner, setOwner] = useState(TECHNICIANS[0]?.name || '')
  const [status, setStatus] = useState('Draft')
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(''); setTrigger(''); setConditions([]); setChosen([])
      setOwner(TECHNICIANS[0]?.name || ''); setStatus('Draft'); setCustom('')
    }
  }

  if (!open) return null

  const flip = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const addCustom = () => {
    const v = custom.trim()
    if (!v || conditions.includes(v)) return
    setConditions((p) => [...p, v])
    setCustom('')
  }
  const canSave = Boolean(name.trim() && trigger && chosen.length)

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="New workflow"
      subtitle="When something happens, if it matches, then do this"
      width={620}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%' }}>
          <span style={{ fontSize: 11, color: MUTE }}>
            {trigger ? `When ${trigger.toLowerCase()}` : 'Pick a trigger'}
            {conditions.length ? ` · ${conditions.length} condition${conditions.length === 1 ? '' : 's'}` : ''}
            {chosen.length ? ` · ${chosen.length} action${chosen.length === 1 ? '' : 's'}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton variant="ghost" onClick={onClose} disabled={busy}>Cancel</ActionButton>
            <ActionButton
              disabled={!canSave || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onCreate({
                    name: name.trim(),
                    trigger,
                    conditions,
                    actions: chosen,
                    status,
                    owner_name: owner,
                  })
                } finally { setBusy(false) }
              }}
            >
              Create workflow
            </ActionButton>
          </div>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Name" hint="What it does, in the words somebody would search for.">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Escalate breakdowns on critical assets" style={input} />
        </Field>

        <Field label="When" hint="The event that fires the rule. Only events this portal actually raises are offered.">
          <select value={trigger} onChange={(e) => { setTrigger(e.target.value); setConditions([]) }} style={input}>
            <option value="">Choose a trigger…</option>
            {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field
          label="If (optional)"
          hint={trigger
            ? 'Every condition must hold. With none, the rule fires on every event.'
            : 'Pick a trigger first — which conditions make sense depends on it.'}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(CONDITIONS[trigger] || []).map((c) => (
              <Chip key={c} on={conditions.includes(c)} tone={AMBER}
                onClick={() => flip(conditions, setConditions, c)}>{c}</Chip>
            ))}
            {conditions.filter((c) => !(CONDITIONS[trigger] || []).includes(c)).map((c) => (
              <Chip key={c} on tone={AMBER} onClick={() => flip(conditions, setConditions, c)}>{c}</Chip>
            ))}
            {!trigger && <span style={{ fontSize: 11.5, color: MUTE }}>Nothing to choose yet.</span>}
          </div>
          {trigger && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                value={custom} onChange={(e) => setCustom(e.target.value)}
                placeholder="Or write your own condition" style={{ ...input, flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              />
              <ActionButton size="sm" variant="subtle" disabled={!custom.trim()} onClick={addCustom}>Add</ActionButton>
            </div>
          )}
        </Field>

        <Field label="Then" hint="At least one — a rule with nothing to do fires correctly forever and changes nothing.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ACTIONS.map((a) => (
              <Chip key={a} on={chosen.includes(a)} tone={GREEN}
                onClick={() => flip(chosen, setChosen, a)}>{a}</Chip>
            ))}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Owner">
            <select value={owner} onChange={(e) => setOwner(e.target.value)} style={input}>
              {TECHNICIANS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Start as" hint="A draft is saved but never fires until it is activated.">
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function Chip({ on, tone, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11.5, fontWeight: 600, textAlign: 'left',
        background: on ? `${tone}18` : '#fff',
        color: on ? tone : SUB,
        borderStyle: 'solid', borderWidth: 1, borderColor: on ? tone : LINE,
      }}
    >{children}</button>
  )
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: INK, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 6, lineHeight: 1.45 }}>{hint}</span>}
    </label>
  )
}

function Step({ label, tone, children }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
        color: tone, minWidth: 34, flexShrink: 0,
      }}>{label}</span>
      <span style={{ fontSize: 12.5, color: INK, lineHeight: 1.45 }}>{children}</span>
    </div>
  )
}

const nameBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 14, fontWeight: 700, color: INK, textAlign: 'left',
}
const rowLine = { padding: '7px 0', borderBottom: `1px solid ${LINE}`, fontSize: 12.5, color: SUB }
const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  fontFamily: 'inherit', color: INK, background: '#fff', borderRadius: 9, outline: 'none',
  borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
}
