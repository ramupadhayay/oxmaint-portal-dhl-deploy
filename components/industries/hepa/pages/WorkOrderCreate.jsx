'use client'

// Create Work Order.
//
// On its own route rather than behind a modal, so it can be linked to and
// bookmarked, and so a half-filled form is not lost to a stray click outside
// it — which is also where the product puts it.
//
// The screen is three things stacked: a navigator card that shows all nine
// sections at once and says which of them are required, the section itself,
// and a rail that only ever complains about sections the reader has actually
// opened. That last rule is the reason the form is bearable: a create screen
// that turns red before it has been read is one people stop reading.
//
// The asset is picked from the registry rather than typed. An order against a
// filter nobody holds is the row that reaches SAP and bounces.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeading, PALETTE } from '../lib/kit'
import { Glyph, BRAND, Action } from '../lib/productKit'
import { useStore } from '../lib/store'
import { createWorkOrder, useCreatedOrders, nextOrderNumber } from '../lib/ops'
import {
  STEPS, TIPS, GUIDANCE, validate, statusOf,
} from '../lib/workOrderForm'
import {
  BasicStep, TasksStep, AdvancedStep, PartsStep, AttachmentsStep,
  LabourStep, RemarksStep, CostsStep, ReviewStep,
} from '../components/workOrderSteps'

const { INK, SUB, MUTE, LINE } = PALETTE

const BLANK = {
  title: '', workOrderType: '', priority: '', filterId: '', functionalLocation: '', description: '',
  assignedTo: '', assignedDepartment: '',
  requestedDate: '', scheduledStart: '', scheduledEnd: '', actualStart: '', actualEnd: '',
  estimatedDuration: '', shutdown: '',
  problem: '', riskLevel: '', safety: '', budgetCode: '',
  requiresApproval: false, requiresPermits: false, shutdownWork: false, lubrication: false,
  photosRequired: false, signatureRequired: false, requiresInspection: false, mobile: false,
  tasks: [], parts: [], attachments: [], labour: [], remarks: [], costs: [],
}

export default function WorkOrderCreate() {
  const router = useRouter()
  const store = useStore()
  const created = useCreatedOrders()

  const [form, setForm] = useState(BLANK)
  const [step, setStep] = useState('basic')
  const [visited, setVisited] = useState(() => new Set(['basic']))
  // Sections the reader has moved on from. A field only goes red once its own
  // section has been left or the review has been opened — marking a field
  // wrong while somebody is still typing into it is the complaint people have
  // about forms, not a help.
  const [left, setLeft] = useState(() => new Set())
  const [busy, setBusy] = useState(false)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const errors = useMemo(() => validate(form), [form])
  const ready = Object.keys(errors).length === 0
  const orderNumber = nextOrderNumber(created)

  const index = STEPS.findIndex((s) => s.key === step)
  const first = index === 0
  const last = index === STEPS.length - 1

  const goTo = (key) => {
    if (key !== step) setLeft((l) => new Set([...l, step]))
    setStep(key)
    setVisited((v) => new Set([...v, key]))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async () => {
    if (!ready) { goTo('review'); return }
    setBusy(true)
    const order = await createWorkOrder(store, {
      filterId: form.filterId,
      orderType: form.workOrderType,
      priority: form.priority,
      technicianName: form.assignedTo,
      description: form.description,
      detail: form,
    }, created)
    setBusy(false)
    if (order) router.push('/portal/hepa/work-orders')
  }

  const required = STEPS.filter((s) => s.required)
  const optional = STEPS.filter((s) => !s.required)

  return (
    <div>
      <PageHeading
        back={{ label: 'Work orders', onClick: () => router.push('/portal/hepa/work-orders') }}
        title="Create Work Order"
        subtitle="Create a new maintenance work order with comprehensive details and safety requirements"
        right={<Action icon="sparkle" onClick={() => goTo('tasks')}>Use template</Action>}
      />

      {/* The navigator. Required sections in a tinted column of their own,
          optional ones two-up beside them — the arrangement is what tells a
          reader which three they cannot skip, so it is copied rather than
          flattened into a row of numbered circles. */}
      <section style={styles.navCard}>
        <div style={styles.navHint}>
          <Glyph name="info" size={14} color={BRAND[600]} />
          Click a section to navigate directly
        </div>

        <div className="hepa-wo-nav">
          <div style={styles.requiredCol}>
            <div style={styles.badgeRow}>
              <span style={{ ...styles.badge, background: BRAND[100], color: BRAND[700] }}>REQUIRED</span>
              <span style={{ ...styles.rule, background: '#c7d2fe' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {required.map((s) => (
                <StepButton key={s.key} step={s} current={step === s.key}
                  status={statusOf(s.key, errors, visited)} onClick={() => goTo(s.key)} accent />
              ))}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={styles.badgeRow}>
              <span style={{ ...styles.badge, background: '#f1f5f9', color: MUTE }}>OPTIONAL</span>
              <span style={{ ...styles.rule, background: '#f1f5f9' }} />
            </div>
            <div style={styles.optionalGrid}>
              {optional.map((s) => (
                <StepButton key={s.key} step={s} current={step === s.key}
                  status={statusOf(s.key, errors, visited)} onClick={() => goTo(s.key)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .hepa-wo-nav { display: grid; gap: 18px; grid-template-columns: 1fr; align-items: start; }
        @media (min-width: 1040px) { .hepa-wo-nav { grid-template-columns: minmax(260px, 1fr) 2fr; } }
        .hepa-wo-body { display: grid; gap: 16px; grid-template-columns: 1fr; align-items: start; }
        @media (min-width: 1240px) { .hepa-wo-body { grid-template-columns: minmax(0, 3fr) minmax(280px, 1fr); } }
        @media (min-width: 1240px) { .hepa-wo-rail { position: sticky; top: 70px; } }
      `}</style>

      <div className="hepa-wo-body">
        <div style={{ minWidth: 0 }}>
          {step === 'basic' && <BasicStep form={form} set={set} errors={errors} showErrors={left.has('basic') || visited.has('review')} />}
          {step === 'tasks' && <TasksStep form={form} set={set} errors={errors} showErrors={left.has('tasks') || visited.has('review')} />}
          {step === 'advanced' && <AdvancedStep form={form} set={set} />}
          {step === 'parts' && <PartsStep form={form} set={set} />}
          {step === 'attachments' && <AttachmentsStep form={form} set={set} />}
          {step === 'labour' && <LabourStep form={form} set={set} />}
          {step === 'remarks' && <RemarksStep form={form} set={set} />}
          {step === 'costs' && <CostsStep form={form} set={set} />}
          {step === 'review' && (
            <ReviewStep form={form} errors={errors} orderNumber={orderNumber} onGoTo={goTo} />
          )}

          {step === 'review' ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => router.push('/portal/hepa/work-orders')}
                disabled={busy} style={styles.ghost}>
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={busy || !ready || !store.ready}
                style={{ ...styles.primary, opacity: busy || !ready || !store.ready ? 0.5 : 1 }}>
                <Glyph name="send" size={15} color="#fff" />
                {busy ? 'Creating…' : 'Create Work Order'}
              </button>
            </div>
          ) : (
            <div style={styles.footer}>
              <button type="button" onClick={() => goTo(STEPS[index - 1].key)} disabled={first}
                style={{ ...styles.ghost, opacity: first ? 0.4 : 1 }}>
                <Glyph name="back" size={15} color={MUTE} />
                Previous
              </button>
              <button type="button" onClick={() => goTo(STEPS[index + 1].key)} disabled={last}
                style={{ ...styles.ghost, color: BRAND[700], opacity: last ? 0.4 : 1 }}>
                Next
                <Glyph name="next" size={15} color={BRAND[700]} />
              </button>
            </div>
          )}
        </div>

        <div className="hepa-wo-rail" style={{ minWidth: 0 }}>
          <Rail errors={errors} visited={visited} step={step} onGoTo={goTo} />
        </div>
      </div>
    </div>
  )
}

// ── the navigator's buttons ───────────────────────────────────────────────

function StepButton({ step, current, status, onClick, accent }) {
  const tone = current ? 'current' : status
  const skin = {
    current: { border: '#c7d2fe', bg: '#f6f7fd', fg: BRAND[700], dot: BRAND[600] },
    complete: { border: '#bbf7d0', bg: '#fff', fg: '#15803d', dot: '#16a34a' },
    error: { border: '#fecaca', bg: '#fff', fg: '#b91c1c', dot: '#dc2626' },
    empty: accent
      ? { border: '#e0e7ff', bg: 'rgba(240,242,255,.5)', fg: BRAND[700], dot: BRAND[600] }
      : { border: LINE, bg: '#fff', fg: SUB, dot: '#cbd5e1' },
  }[tone]

  const mark = status === 'complete' && !current ? 'check'
    : status === 'error' && !current ? 'warning'
      : step.icon

  return (
    <button type="button" onClick={onClick}
      style={{ ...styles.stepBtn, borderColor: skin.border, background: skin.bg }}>
      <span style={{ ...styles.stepIcon, background: skin.dot }}>
        <Glyph name={mark} size={17} color="#fff" />
      </span>
      <span style={{ minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: skin.fg, overflowWrap: 'anywhere' }}>
          {step.title}
        </span>
        <span style={{ display: 'block', fontSize: 11.5, color: MUTE, marginTop: 2, overflowWrap: 'anywhere' }}>
          {step.description}
        </span>
      </span>
    </button>
  )
}

// ── the rail ──────────────────────────────────────────────────────────────

function Rail({ errors, visited, step, onGoTo }) {
  // Only sections the reader has opened. See the note at the top of the file.
  const open = Object.entries(errors).filter(([key]) => visited.has(key))
  const count = open.reduce((sum, [, list]) => sum + list.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {open.length > 0 && (
        <RailCard title={`Complete Information Required (${count})`} icon="info" tone="#b45309" border="#fde68a">
          {open.map(([key, list]) => (
            <div key={key} style={{ marginBottom: 9 }}>
              <button type="button" onClick={() => onGoTo(key)} style={styles.railLink}>
                {STEPS.find((s) => s.key === key)?.title}
                <span style={styles.railCount}>{list.length} field{list.length === 1 ? '' : 's'}</span>
              </button>
              {list.map((m) => <p key={m} style={styles.railError}>{m}</p>)}
            </div>
          ))}
        </RailCard>
      )}

      {open.length === 0 && visited.size > 1 && (
        <div style={{ ...styles.railCard, borderColor: '#bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Glyph name="check" size={15} color="#15803d" />
            <strong style={{ fontSize: 12.5, color: '#15803d' }}>All sections complete</strong>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 11.5, color: '#16a34a', lineHeight: 1.5 }}>
            All visited sections have the required information!
          </p>
        </div>
      )}

      <RailCard title="Current Step Tips" icon="info" tone={SUB} border={LINE}>
        {(TIPS[step] || []).map((tip) => (
          <p key={tip} style={styles.tip}>
            <Glyph name="info" size={12} color={MUTE} />
            <span>{tip}</span>
          </p>
        ))}
      </RailCard>

      <RailCard title="Synapse AI Assistant" icon="bulb" tone={BRAND[700]} border={LINE}>
        {GUIDANCE.map((g) => (
          <div key={g.title} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: SUB }}>{g.title}</div>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: MUTE, lineHeight: 1.6 }}>{g.description}</p>
          </div>
        ))}
      </RailCard>
    </div>
  )
}

function RailCard({ title, icon, tone, border, children }) {
  return (
    <section style={{ ...styles.railCard, borderColor: border }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <Glyph name={icon} size={15} color={tone} />
        <strong style={{ fontSize: 12.5, color: tone }}>{title}</strong>
      </div>
      {children}
    </section>
  )
}

const styles = {
  navCard: {
    background: '#fff', borderRadius: 12, padding: 18, marginBottom: 16,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    boxShadow: '0 1px 2px rgba(15,23,42,.04)',
  },
  navHint: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7,
    fontSize: 12, color: BRAND[700], marginBottom: 12,
  },
  requiredCol: {
    padding: 16, borderRadius: 12, minWidth: 0,
    background: 'rgba(240,242,255,.45)',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#e0e7ff',
  },
  badgeRow: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 15 },
  badge: {
    padding: '3px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7,
  },
  rule: { height: 1, flex: 1 },
  optionalGrid: {
    display: 'grid', gap: 11,
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  },
  stepBtn: {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%', minWidth: 0,
    padding: 13, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1,
  },
  stepIcon: {
    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}`, flexWrap: 'wrap',
  },
  ghost: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 15px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    color: SUB, background: '#fff', cursor: 'pointer', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  primary: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '10px 18px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
    color: '#fff', background: BRAND[600], border: 'none', borderRadius: 9, cursor: 'pointer',
  },
  railCard: {
    background: '#fff', borderRadius: 11, padding: '14px 15px',
    borderStyle: 'solid', borderWidth: 1,
  },
  railLink: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: 0, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', color: SUB,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  railCount: {
    marginLeft: 'auto', flexShrink: 0, padding: '1px 7px', borderRadius: 999,
    fontSize: 10.5, fontWeight: 700, color: '#b45309',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a',
  },
  railError: {
    margin: '5px 0 0', padding: '6px 9px', borderRadius: 7, background: '#fffbeb',
    fontSize: 11, color: '#92400e', lineHeight: 1.5,
    borderStyle: 'solid', borderWidth: 1, borderColor: '#fde68a',
  },
  tip: {
    display: 'flex', alignItems: 'flex-start', gap: 7, margin: '0 0 8px',
    fontSize: 11.5, color: MUTE, lineHeight: 1.55,
  },
}
