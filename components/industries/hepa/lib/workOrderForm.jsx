'use client'

// The pieces the Create Work Order form is built from.
//
// The product's create screen is nine sections behind one navigator card, and
// the shape of it carries meaning: three sections are required and sit in a
// tinted column on the left, the rest are optional and sit in a two-up grid on
// the right. A reader who has used the product knows at a glance which ones
// they cannot skip. That is why the navigator is copied rather than replaced
// with a plain wizard strip.
//
// Field labels, step titles, tips and the assistant copy are the product's own
// wording, taken from its message catalogue rather than reworded — a form that
// says almost the same thing reads as a different product.

import { PALETTE } from './kit'
import { BRAND } from './productKit'

const { INK, SUB, MUTE, LINE } = PALETTE

// ── the nine sections ─────────────────────────────────────────────────────

/**
 * In the product's order, which is not the order they are numbered in: basic,
 * then tasks, then everything optional, then review. `required` is what puts a
 * section in the left column of the navigator.
 */
export const STEPS = [
  { key: 'basic', title: 'Basic Information', description: 'Essential work order details and scheduling', icon: 'clipboard', required: true },
  { key: 'tasks', title: 'Task List', description: 'Define tasks and work breakdown', icon: 'list', required: true },
  { key: 'advanced', title: 'Advanced Details', description: 'Safety requirements and compliance settings', icon: 'shield' },
  { key: 'parts', title: 'Parts & Materials', description: 'Required parts and materials', icon: 'box' },
  { key: 'attachments', title: 'Attachments', description: 'Supporting documents and files', icon: 'paperclip' },
  { key: 'labour', title: 'Labour & Resources', description: 'Labour codes and resource assignments', icon: 'user' },
  { key: 'remarks', title: 'Remarks & Notes', description: 'Additional notes and observations', icon: 'message' },
  { key: 'costs', title: 'Costs & Budget', description: 'Cost tracking and budget information', icon: 'coins' },
  { key: 'review', title: 'Review & Submit', description: 'Review all information before submitting', icon: 'rocket', required: true },
]

/** The rail's step-specific tips, in the product's wording. */
export const TIPS = {
  basic: [
    'Select an asset first to enable AI generation',
    'Use the AI Generate button to auto-fill most fields',
    'Priority affects work order scheduling and resource allocation',
  ],
  tasks: [
    'Break down complex work into smaller, manageable tasks',
    'Set realistic time estimates for better planning',
    'Mark critical tasks that require approval',
  ],
  advanced: [
    'High-risk work orders require additional safety measures',
    'Shutdown work affects asset availability planning',
    'Enable permits for regulated maintenance activities',
  ],
  parts: [
    'Add all required parts to ensure material availability',
    'Mark critical parts to prioritize procurement',
    'Use accurate quantities to avoid delays',
  ],
  attachments: [
    'Include technical drawings, manuals, or photos',
    'Safety procedures and work instructions are helpful',
    'Reference documents improve work quality',
  ],
  labour: [
    'Assign skilled technicians for complex tasks',
    'Consider labour availability when scheduling',
    'Include overtime rates if applicable',
  ],
  remarks: [
    'Document special instructions or constraints',
    'Include safety warnings or environmental concerns',
    'Note any asset-specific requirements',
  ],
  costs: [
    'Track all costs for accurate budgeting',
    'Include contractor costs and equipment rental',
    'Monitor cost variance against estimates',
  ],
  review: [
    'Review all sections for completeness',
    "Verify scheduling doesn't conflict with other work",
    'Ensure all safety requirements are addressed',
  ],
}

/** The assistant panel at the foot of the rail. */
export const GUIDANCE = [
  {
    title: 'AI-Powered Work Order Generation',
    description: "Select an asset and click 'AI Generate' to automatically populate tasks, parts lists, "
      + 'safety requirements, and time estimates based on industry best practices.',
  },
  {
    title: 'Intelligent Maintenance Assistance',
    description: 'Ask Synapse AI specific questions about maintenance procedures, safety protocols, or '
      + 'equipment specifications using natural language queries.',
  },
  {
    title: 'Compliance and Safety Guidance',
    description: 'Get instant recommendations for regulatory compliance, safety measures, and risk '
      + 'assessments tailored to your specific equipment and work type.',
  },
  {
    title: 'Best Practice Recommendations',
    description: 'Leverage AI insights for optimal scheduling, resource allocation, and maintenance '
      + 'strategies based on equipment type and operational requirements.',
  },
  {
    title: 'Technical Documentation Support',
    description: 'Request step-by-step procedures, troubleshooting guides, and technical specifications '
      + 'for specific equipment models and maintenance tasks.',
  },
]

export const RISK_LEVELS = [
  { value: '', label: 'No risk assessment' },
  { value: 'Critical', label: 'Critical — highest safety protocols required' },
  { value: 'High', label: 'High — enhanced safety measures' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
]

export const REMARK_TYPES = ['General', 'Completion', 'Issue', 'Safety']
export const COST_TYPES = ['Labour', 'Material', 'Equipment', 'Service', 'Other']

/**
 * The labour codes the product ships. They are trade codes, not names of
 * anyone at this site, so they carry across unchanged; HVAC and Inspection are
 * the two a filter job actually lands on.
 */
export const LABOUR_CODES = [
  { code: 'HVAC', name: 'HVAC Maintenance' },
  { code: 'INSP', name: 'Inspection' },
  { code: 'MECH', name: 'Mechanical Maintenance' },
  { code: 'ELEC', name: 'Electrical Maintenance' },
  { code: 'INST', name: 'Instrumentation' },
  { code: 'SUPR', name: 'Supervision' },
  { code: 'HELP', name: 'Helper/Assistant' },
]

// ── what counts as filled in ──────────────────────────────────────────────

/**
 * Which sections are short of something, in the product's own terms.
 *
 * The product only shows a section as wrong once it has been opened — a form
 * that turns red before it has been read is a form people stop reading. So the
 * caller passes the set of sections the reader has actually visited and the
 * status of the rest comes back as `empty`.
 */
export function validate(form) {
  const e = {}

  const basic = []
  if (!form.title?.trim()) basic.push('Work Order Title is required')
  if (!form.workOrderType) basic.push('Work Order Type is required')
  if (!form.priority) basic.push('Priority is required')
  if (!form.filterId) basic.push('Related Asset is required')
  if (!form.description?.trim()) basic.push('Description is required')
  if (basic.length) e.basic = basic

  const tasks = []
  if (!form.tasks?.length) tasks.push('At least one task is required')
  else if (form.tasks.some((t) => !t.description?.trim())) tasks.push('Every task needs a description')
  if (tasks.length) e.tasks = tasks

  // Scheduling that runs backwards is the one thing on this form worth
  // stopping, because it reaches SAP as a date pair and is rejected there.
  if (form.scheduledStart && form.scheduledEnd && form.scheduledEnd < form.scheduledStart) {
    e.basic = [...(e.basic || []), 'Scheduled End Date falls before the start']
  }

  return e
}

export function statusOf(key, errors, visited) {
  if (!visited.has(key)) return 'empty'
  return errors[key]?.length ? 'error' : 'complete'
}

// ── field primitives ──────────────────────────────────────────────────────

export function FormCard({ title, icon, right, children, style }) {
  return (
    <section style={{ ...styles.card, ...style }}>
      <header style={styles.cardHead}>
        <span style={styles.cardTitle}>
          {icon}
          {title}
        </span>
        {right}
      </header>
      <div style={styles.cardBody}>{children}</div>
    </section>
  )
}

export function Grid({ cols = 2, children, style }) {
  return (
    <div style={{
      display: 'grid', gap: 14, alignItems: 'start',
      gridTemplateColumns: `repeat(auto-fit, minmax(${cols >= 4 ? 190 : 240}px, 1fr))`,
      ...style,
    }}>
      {children}
    </div>
  )
}

export function Field({ label, required, hint, error, children, dim }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ ...styles.label, color: dim ? MUTE : SUB }}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {hint && <span style={styles.hint}>{hint}</span>}
      {error && <span style={{ ...styles.hint, color: '#b91c1c' }}>{error}</span>}
    </label>
  )
}

export function Input({ style, ...rest }) {
  return <input {...rest} style={{ ...styles.input, ...style }} />
}

export function Select({ children, style, ...rest }) {
  return <select {...rest} style={{ ...styles.input, cursor: 'pointer', ...style }}>{children}</select>
}

export function Textarea({ style, ...rest }) {
  return <textarea {...rest} style={{ ...styles.input, minHeight: 92, lineHeight: 1.55, resize: 'vertical', ...style }} />
}

/** The product's switch rows: a title, a line of explanation, a toggle. */
export function Toggle({ label, description, checked, onChange }) {
  return (
    <div role="button" tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onChange(!checked) } }}
      style={{ ...styles.toggleRow, borderColor: checked ? '#c7d2fe' : LINE, background: checked ? '#f6f7fd' : '#fff' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: INK }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11, color: MUTE, marginTop: 2, lineHeight: 1.45 }}>{description}</span>
      </span>
      <span style={{ ...styles.track, background: checked ? BRAND[600] : '#e2e8f0' }}>
        <span style={{ ...styles.knob, transform: checked ? 'translateX(15px)' : 'translateX(0)' }} />
      </span>
    </div>
  )
}

/** The empty state each optional section shows before anything is added. */
export function StepEmpty({ title, description, action }) {
  return (
    <div style={styles.empty}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: SUB }}>{title}</p>
      <p style={{ margin: '5px 0 0', fontSize: 12, color: MUTE, lineHeight: 1.55 }}>{description}</p>
      {action && <div style={{ marginTop: 13 }}>{action}</div>}
    </div>
  )
}

/** One added row — a task, a part, a remark — numbered, with a remove control. */
export function RowCard({ index, title, onRemove, children }) {
  return (
    <div style={styles.rowCard}>
      <div style={styles.rowHead}>
        <span style={styles.seq}>{index + 1}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: SUB, minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
        <button type="button" onClick={onRemove} style={styles.remove} aria-label="Remove">Remove</button>
      </div>
      {children}
    </div>
  )
}

export function AddButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={styles.add}>+ {children}</button>
  )
}

export const styles = {
  card: {
    background: '#fff', borderRadius: 12, marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    boxShadow: '0 1px 2px rgba(15,23,42,.04)',
  },
  cardHead: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '15px 18px 0',
  },
  cardTitle: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 15, fontWeight: 800, color: INK,
  },
  cardBody: { padding: '15px 18px 18px' },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6,
  },
  hint: { display: 'block', fontSize: 11, color: MUTE, marginTop: 5, lineHeight: 1.45 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: INK, background: '#fff', borderRadius: 9, outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  toggleRow: {
    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none',
    padding: '11px 13px', borderRadius: 10, borderStyle: 'solid', borderWidth: 1,
  },
  track: {
    width: 34, height: 19, borderRadius: 999, flexShrink: 0, marginLeft: 'auto',
    display: 'inline-flex', alignItems: 'center', padding: 2, boxSizing: 'border-box',
    transition: 'background .15s',
  },
  knob: {
    width: 15, height: 15, borderRadius: '50%', background: '#fff',
    boxShadow: '0 1px 2px rgba(15,23,42,.25)', transition: 'transform .15s',
  },
  empty: {
    padding: '28px 20px', textAlign: 'center', borderRadius: 10,
    borderStyle: 'dashed', borderWidth: 1, borderColor: LINE, background: '#fcfdfe',
  },
  rowCard: {
    padding: 13, borderRadius: 10, background: '#fcfdfe', marginBottom: 10,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  rowHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 },
  seq: {
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: BRAND[100],
    color: BRAND[700], fontSize: 11, fontWeight: 800,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  remove: {
    marginLeft: 'auto', flexShrink: 0, padding: '4px 9px', fontSize: 11, fontWeight: 700,
    fontFamily: 'inherit', color: '#b91c1c', background: '#fff', cursor: 'pointer',
    borderRadius: 7, borderStyle: 'solid', borderWidth: 1, borderColor: '#fecaca',
  },
  add: {
    padding: '8px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    color: '#fff', background: BRAND[600], border: 'none', borderRadius: 9, cursor: 'pointer',
  },
}
