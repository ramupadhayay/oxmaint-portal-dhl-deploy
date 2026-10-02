'use client'

// The screen a technician lands on after pressing Start work.
//
// It is deliberately not the detail drawer. The drawer is for reading a job and
// deciding about it; this is for doing it — a running timer, the task list
// worked one line at a time, somewhere to put the hours, and the status control.
// Those are the things that happen while the spanner is in someone's hand.
//
// It takes everything as props and holds no store and no router of its own. The
// list screen owns the record and the writes, so this screen cannot half-save a
// job, and it can be dropped onto any other screen that has a work order in
// hand — My Tasks, the calendar — without dragging a data layer behind it.

import { useEffect, useRef, useState } from 'react'
import { Card, ActionButton, StatusBadge, Priority, Bar, PALETTE } from '../lib/kit'
import { fmtDate, isPast, daysUntil } from '../lib/data'

const { INK, SUB, MUTE, LINE, ACCENT, GREEN } = PALETTE

// Where a job can go from where it is.
//
// These are the moves the list screen offers as buttons, so a technician cannot
// reach a state from here that a supervisor cannot reach there — a one-way door
// between the two screens is how a backlog ends up with jobs nobody can close.
// Draft carries one extra: issuing a planned job without starting it, which is a
// planner's move and has no button on a list of live work.
const FLOW = {
  Draft: ['Open', 'In Progress', 'Cancelled'],
  Open: ['In Progress', 'On Hold', 'Cancelled'],
  'In Progress': ['On Hold', 'Completed', 'Cancelled'],
  'On Hold': ['In Progress', 'Cancelled'],
  Completed: ['In Progress', 'Closed'],
  Closed: [],
  Cancelled: [],
}

// What the toast says the job did, rather than the state it landed in. "WO-2611
// — in progress" is the machine's sentence; "work started" is the technician's.
const VERB = {
  Open: 'reopened', 'In Progress': 'work started', 'On Hold': 'put on hold',
  Completed: 'completed', Closed: 'closed', Cancelled: 'cancelled',
}

const hms = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')

// The two steps in the middle of the job that depend on what the machine is.
//
// Matched on a keyword rather than on the exact asset type, because two data
// packs ship and neither spells its plant the same way — 'Centrifugal Chiller',
// 'Screw Chiller' and plain 'Chiller' are one machine to a fitter, and a table
// keyed by one pack's type list is empty for the other. Anything unrecognised
// falls through to the general steps, which is what an unfamiliar asset type is
// most likely to be: a rotating machine with a fault on it.
//
// Order matters in one place: 'compressor' contains the letters of 'press', so
// the press entry is anchored on word boundaries and sits below it.
const MACHINE_STEPS = [
  { match: /chiller/, steps: [
    'Record suction, discharge and oil pressures before the circuit is broken',
    'Carry out the repair to the OEM procedure, then leak test before recharging',
  ] },
  { match: /cooling tower|cooler/, steps: [
    'Lock off the fan drive and check the gearbox oil level and fill condition',
    'Carry out the repair to the OEM procedure, then check basin level and make-up on restart',
  ] },
  { match: /pump/, steps: [
    'Drain and vent the casing, then check the seal faces and coupling condition',
    'Carry out the repair to the OEM procedure and re-align the coupling before coupling up',
  ] },
  { match: /compressor/, steps: [
    'Vent the receiver and confirm the line is at zero pressure before any joint is broken',
    'Carry out the repair to the OEM procedure, then check belt tension and filter condition',
  ] },
  { match: /boiler/, steps: [
    'Isolate the fuel train and confirm the burner is locked out',
    'Carry out the repair to the OEM procedure and complete the flame safeguard checks',
  ] },
  { match: /conveyor/, steps: [
    'Guard the drive, release belt tension and check tracking against the wear marks',
    'Carry out the repair to the OEM procedure and re-tension the belt to specification',
  ] },
  { match: /\bpress\b|hydraulic/, steps: [
    'Block the ram and dump stored hydraulic pressure before any line is broken',
    'Carry out the repair to the OEM procedure and prove the guard interlocks before running',
  ] },
  { match: /air handling|\bahu\b|handler/, steps: [
    'Stop the fan, prove the drive dead and check filter and belt condition',
    'Carry out the repair to the OEM procedure and check the dampers stroke fully',
  ] },
  { match: /gearbox/, steps: [
    'Take an oil sample and record its condition before draining',
    'Carry out the repair to the OEM procedure and re-align the drive before refilling',
  ] },
  { match: /extruder/, steps: [
    'Bring the barrel zones down and confirm the heater circuits are isolated',
    'Carry out the repair to the OEM procedure and check the zone temperature profile',
  ] },
  { match: /forklift|truck|vehicle/, steps: [
    'Park, chock and lower the forks fully, then isolate the battery',
    'Carry out the repair to the OEM procedure and check the mast chains and brakes',
  ] },
  { match: /monitor|purge|detector|analyser|transmitter|sensor/, steps: [
    'Record the current reading and the last calibration date before the unit is disturbed',
    'Carry out the work to the OEM procedure and re-calibrate against the reference',
  ] },
]

const GENERAL_STEPS = [
  'Confirm the reported fault at the machine before anything is stripped down',
  'Carry out the repair to the OEM procedure',
]

function defaultTasks(wo, asset) {
  // A job raised in this portal carries the planner's own breakdown from the
  // create screen. Where it does, that list is the job — generating one over the
  // top would throw away the work the planner already did.
  const planned = (Array.isArray(wo.tasks) ? wo.tasks : [])
    .map((t) => (typeof t === 'string' ? t : t.description || t.label))
    .filter(Boolean)
  if (planned.length) return planned.map((label, i) => ({ id: i + 1, label, done: false }))

  // The asset record is the better source, but a job raised against a functional
  // location has none — and the asset name it does carry ("Screw Chiller 04")
  // holds the same word the match is looking for.
  const kind = String(asset?.asset_type || wo.asset_name || '').toLowerCase()
  const middle = (MACHINE_STEPS.find((m) => m.match.test(kind)) || { steps: GENERAL_STEPS }).steps
  const thing = wo.asset_name || asset?.asset_name || 'the asset'

  return [
    'Check the permit is issued and the work is authorised for this shift',
    `Isolate ${thing}, lock off and prove zero energy at the machine`,
    'Confirm the parts and consumables are staged at the job',
    ...middle,
    'Remove the locks, function test and hand the asset back to production',
    'Record findings, parts used and hours against the work order',
  ].map((label, i) => ({ id: i + 1, label, done: false }))
}

export default function WorkOrderExecution({ wo, asset, onBack, applyStatus, notify }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [tasks, setTasks] = useState(() => defaultTasks(wo, asset))
  const [newTask, setNewTask] = useState('')
  const [hrs, setHrs] = useState('')
  const [mins, setMins] = useState('')

  // A counter rather than a timestamp, the way the completion modal keys its
  // part lines. Nothing in this portal reads the clock for an identifier: two
  // ids drawn in the same millisecond are the same id, and two task lines
  // sharing one key tick each other on and off.
  const taskSeq = useRef(tasks.length)

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const S = wo.status
  const doneCount = tasks.filter((t) => t.done).length
  const outstanding = tasks.length - doneCount
  const pct = tasks.length ? (doneCount / tasks.length) * 100 : 0
  const late = isPast(wo.due_date) && S !== 'Completed' && S !== 'Closed'

  const toggleTask = (id) => setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const addTask = () => {
    const label = newTask.trim()
    if (!label) return
    taskSeq.current += 1
    setTasks([...tasks, { id: taskSeq.current, label, done: false }])
    setNewTask('')
  }
  const removeTask = (id) => setTasks(tasks.filter((t) => t.id !== id))

  // Typed time wins over the timer. A technician who forgot to start it and
  // knows the job took forty minutes should not have to run a stopwatch for
  // forty minutes to say so.
  const loggedMinutes = () => ((Number(hrs) || 0) * 60 + (Number(mins) || 0)) || Math.round(elapsed / 60)

  const complete = async () => {
    const m = loggedMinutes()
    setRunning(false)
    // Booked as hours, not minutes: every cost, MTTR and labour figure in the
    // portal is in hours, and a record that carries two units is one somebody
    // eventually averages together.
    //
    // The label is null because the message below is the better one — it says
    // what was logged, not just that the status moved. And the screen only
    // stands down once the write has actually stuck: leaving on a failed save
    // would take the logged time with it, which is the one thing here nobody
    // can reconstruct afterwards.
    const saved = await applyStatus('Completed', null, { actual_hours: Number((m / 60).toFixed(2)) })
    if (!saved) return
    notify?.(`${wo.work_order_number} completed — ${m} min logged.`)
    onBack()
  }

  const timeChosen = (Number(hrs) || 0) > 0 || (Number(mins) || 0) > 0 || elapsed > 0

  const changeStatus = async (next) => {
    if (!next || next === S) return
    if (next === 'Completed') {
      // The button below is disabled until there is time to book; the dropdown
      // has to say the same thing rather than quietly closing a zero-hour job.
      // Zero hours is not "unknown" once it is written down — it is an average
      // that drags every labour and MTTR figure it lands in.
      if (!timeChosen) { notify?.('Log the time spent before completing this job.', 'error'); return }
      await complete()
      return
    }
    await applyStatus(next, VERB[next] || next.toLowerCase())
    if (next === 'On Hold' || next === 'Cancelled') setRunning(false)
  }

  return (
    <div>
      <button onClick={onBack} style={styles.crumb}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        Back to work order
      </button>

      <div style={styles.grid}>
        {/* ── left: the job, and where it can go next ─────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{wo.work_order_number}</div>
                <div style={{ fontSize: 12.5, color: SUB, marginTop: 3, overflowWrap: 'anywhere' }}>{wo.title}</div>
              </div>
              <StatusBadge>{S}</StatusBadge>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <Row k="Asset" v={wo.asset_code ? `${wo.asset_name} (${wo.asset_code})` : wo.asset_name || '—'} />
              <Row k="Location" v={wo.location_name || asset?.functional_location_name || '—'} />
              <Row k="Site" v={wo.site_name || '—'} />
              <Row k="Assigned to" v={wo.assigned_to_name || 'Unassigned'} />
              <Row k="Type" v={wo.work_order_type || '—'} />
              <Row k="Priority" v={<Priority value={wo.priority} />} />
              <Row k="Due" v={<span style={{ color: late ? '#b91c1c' : INK, fontWeight: late ? 700 : 600 }}>
                {fmtDate(wo.due_date)}{late ? ` · ${Math.abs(daysUntil(wo.due_date))}d late` : ''}
              </span>} />
            </div>
          </Card>

          <Card>
            <div style={styles.h}>Change work order status</div>
            <select value={S} onChange={(e) => changeStatus(e.target.value)} style={styles.select}>
              <option value={S} disabled>{S} (current)</option>
              {(FLOW[S] || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(FLOW[S] || []).length === 0 && (
              <div style={{ fontSize: 11.5, color: MUTE, marginTop: 8 }}>This work order is closed — no further transitions.</div>
            )}
          </Card>

          <Card>
            <div style={styles.h}>Task execution</div>
            <Row k="Progress" v={`${doneCount} / ${tasks.length} tasks`} />
            <div style={{ margin: '9px 0' }}><Bar pct={pct} color={GREEN} /></div>
            <Row k="Estimated" v={wo.estimated_hours != null ? `${wo.estimated_hours} h` : '—'} />
            <Row k="Logged" v={`${loggedMinutes()} min`} />
          </Card>
        </div>

        {/* ── centre: the task list, the clock, and the way out ───────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            ...styles.banner,
            background: S === 'In Progress' ? '#eef6ff' : '#ecfdf5',
            borderColor: S === 'In Progress' ? '#bfdbfe' : '#a7f3d0',
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>
              {S === 'In Progress' ? 'Work in progress' : S === 'Completed' ? 'Work completed' : 'Ready to start work'}
            </div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 3, lineHeight: 1.5 }}>
              {S === 'In Progress'
                ? 'Work the task list, keep the timer running, and complete the job when the asset is back in service.'
                : S === 'Completed'
                  ? 'This job is complete. Reopen it from the work order if more work is needed.'
                  : 'Run the timer and work the task list below.'}
            </div>
          </div>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={styles.h}>Task list <span style={{ color: MUTE, fontWeight: 600 }}>({doneCount}/{tasks.length})</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {tasks.map((t) => (
                <label key={t.id} style={{ ...styles.task, background: t.done ? '#f6fefb' : '#fff', borderColor: t.done ? '#a7f3d0' : LINE }}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} style={{ marginTop: 2 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK, textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.65 : 1 }}>{t.label}</span>
                  <button onClick={(e) => { e.preventDefault(); removeTask(t.id) }} style={styles.rm} aria-label="Remove task">×</button>
                </label>
              ))}
              {!tasks.length && (
                <div style={{ fontSize: 12.5, color: MUTE }}>No tasks on this job. Add the steps as you work them.</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addTask() }}
                placeholder="Add a task…" style={{ ...styles.input, flex: 1, minWidth: 0 }} />
              <ActionButton size="sm" variant="subtle" onClick={addTask}>+ Add task</ActionButton>
            </div>
          </Card>

          <Card>
            <div style={styles.h}>Time tracking</div>
            <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{hms(elapsed)}</div>
              <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>{running ? 'Timer running' : 'Timer stopped'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
              {!running
                ? <ActionButton variant="success" onClick={() => setRunning(true)}>{elapsed ? 'Resume timer' : 'Start timer'}</ActionButton>
                : <ActionButton variant="ghost" onClick={() => setRunning(false)}>Pause timer</ActionButton>}
              {elapsed > 0 && <ActionButton variant="ghost" onClick={() => { setRunning(false); setElapsed(0) }}>Reset</ActionButton>}
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>Or log the time manually and complete:</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label="Hours"><input value={hrs} onChange={(e) => setHrs(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" style={{ ...styles.input, width: 74 }} /></Field>
                <Field label="Minutes"><input value={mins} onChange={(e) => setMins(e.target.value.replace(/[^\d]/g, ''))} placeholder="30" style={{ ...styles.input, width: 74 }} /></Field>
                <div style={{ flex: 1 }} />
                <ActionButton variant="success" disabled={S === 'Completed' || S === 'Closed' || S === 'Cancelled' || !timeChosen} onClick={complete}>
                  Complete with logged time
                </ActionButton>
              </div>
              <div style={{ fontSize: 11, color: MUTE, marginTop: 8, lineHeight: 1.5 }}>
                Completing books {loggedMinutes()} min of labour against {wo.work_order_number}
                {outstanding > 0 ? ` with ${outstanding} task${outstanding === 1 ? '' : 's'} still open` : ''}.
                {' '}Parts are booked against stock from Complete on the work order itself.
              </div>
            </div>
          </Card>
        </div>

        {/* ── right: what the job needs before anyone opens a machine ─────── */}
        <div>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={styles.aiDot} />
              <div style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>Synapse assistant</div>
            </div>
            <div style={{ fontSize: 11.5, color: MUTE, marginBottom: 12 }}>Guidance for this work order</div>
            <div style={styles.aiHeader}>Technician assistant · {wo.work_order_number}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <Bubble>
                Working on <b>{wo.asset_name || 'the asset'}</b>
                {wo.site_name ? ` at ${wo.site_name}` : ''}. {wo.priority} priority, {String(wo.work_order_type || 'corrective').toLowerCase()} work.
              </Bubble>
              <Bubble>
                Isolate to the OEM procedure, apply your own lock and prove zero energy at the machine —
                not at the panel. The permit stays with you until the asset is handed back.
              </Bubble>
              {asset?.criticality === 'High'
                ? <Bubble>This asset is <b>High criticality</b>. Agree the outage with the shift supervisor before it comes out of service, and tell them as soon as you know the job will run past the shift.</Bubble>
                : <Bubble>Stage the parts and consumables at the machine before you break in. A part fetched mid-job is where most of the downtime on a repair goes.</Bubble>}
              {late
                ? <Bubble>This job is <b>{Math.abs(daysUntil(wo.due_date))} days past its due date</b>. If it cannot be finished this shift, put it on hold with a note rather than leaving it running.</Bubble>
                : <Bubble>Record what you actually find, not just what was reported. The next person planning this asset reads your note before they read the history.</Bubble>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
      <span style={{ color: MUTE, flex: '0 0 84px' }}>{k}</span>
      <span style={{ color: INK, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  )
}

function Bubble({ children }) {
  return <div style={{ fontSize: 12, color: INK, lineHeight: 1.5, background: '#f4f6fb', border: `1px solid ${LINE}`, borderRadius: 10, padding: '9px 11px' }}>{children}</div>
}

const styles = {
  crumb: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
    padding: '5px 10px 5px 7px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, color: '#15227a', cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) minmax(min(320px, 100%),1.5fr) minmax(240px,1fr)', gap: 14, alignItems: 'start' },
  h: { fontSize: 13, fontWeight: 800, color: '#15227a', marginBottom: 10 },
  select: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: INK, background: '#fff', borderRadius: 9, outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  input: {
    boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: INK, background: '#fff', borderRadius: 9, outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  banner: { borderStyle: 'solid', borderWidth: 1, borderRadius: 12, padding: '13px 15px' },
  task: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px', borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, cursor: 'pointer' },
  rm: { width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', color: '#b91c1c', fontSize: 15, cursor: 'pointer', lineHeight: 1, flexShrink: 0 },
  aiDot: { width: 9, height: 9, borderRadius: '50%', background: ACCENT, boxShadow: '0 0 0 3px #eef1ff' },
  aiHeader: { fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#1f2d92,#15227a)', borderRadius: 9, padding: '9px 11px' },
}
