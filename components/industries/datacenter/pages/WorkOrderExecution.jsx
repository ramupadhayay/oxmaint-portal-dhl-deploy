'use client'

// The work-execution screen a technician lands on after pressing Start Work.
//
// This mirrors the product's own start-work interface rather than the record
// page: a live timer, a task checklist worked one item at a time, a place to log
// the time spent and complete the job, and the status control — the things you
// do while the work is actually happening, not while you are reading about it.
//
// It opens in place of the record view (the portal keeps its shell around it)
// and hands control back with "Back to work order". A job raised in this portal
// persists its status and logged time through the store; a seeded sample job
// updates on screen only, because there is no record behind it to write to.

import { useState, useEffect } from 'react'
import { Card, ActionButton, StatusBadge, PALETTE } from '../lib/kit'
import { fmtDate } from '../lib/data'

const { INK, SUB, MUTE, LINE, ACCENT, GREEN, AMBER, RED, BLUE } = PALETTE

const STATUS_TONE = { Open: 'amber', Assigned: 'blue', 'In Progress': 'blue', 'On Hold': 'grey', Completed: 'green', Closed: 'grey', Cancelled: 'red' }
const FLOW = {
  Open: ['In Progress', 'On Hold', 'Cancelled'],
  Assigned: ['In Progress', 'On Hold', 'Cancelled'],
  'In Progress': ['On Hold', 'Completed', 'Cancelled'],
  'On Hold': ['In Progress', 'Cancelled'],
  Completed: ['In Progress', 'Closed'],
  Closed: [], Cancelled: [],
}

const hms = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')

function defaultTasks(wo, asset) {
  const thing = asset?.assetName || wo._asset || 'the asset'
  return [
    { id: 1, label: 'Confirm isolation and permits are in place', done: false },
    { id: 2, label: `Inspect ${thing}`, done: false },
    { id: 3, label: 'Carry out the corrective action', done: false },
    { id: 4, label: 'Test and return to service', done: false },
    { id: 5, label: 'Record findings and close out', done: false },
  ]
}

export default function WorkOrderExecution({ wo, asset, onBack, applyStatus, notify }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [tasks, setTasks] = useState(() => defaultTasks(wo, asset))
  const [newTask, setNewTask] = useState('')
  const [hrs, setHrs] = useState('')
  const [mins, setMins] = useState('')

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const doneCount = tasks.filter((t) => t.done).length
  const allDone = tasks.length > 0 && doneCount === tasks.length
  const S = wo.status

  const toggleTask = (id) => setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const addTask = () => {
    const label = newTask.trim()
    if (!label) return
    setTasks([...tasks, { id: Date.now(), label, done: false }])
    setNewTask('')
  }
  const removeTask = (id) => setTasks(tasks.filter((t) => t.id !== id))

  const loggedMinutes = () => ((Number(hrs) || 0) * 60 + (Number(mins) || 0)) || Math.round(elapsed / 60)

  const complete = async () => {
    const m = loggedMinutes()
    setRunning(false)
    await applyStatus('Completed', 'completed', { actualMinutes: m, dateStarted: wo.dateStarted || undefined })
    notify?.(`Work completed — ${m} min logged.`)
    onBack()
  }
  const changeStatus = async (next) => {
    if (!next || next === S) return
    if (next === 'Completed') { await complete(); return }
    await applyStatus(next, next.toLowerCase())
    if (next === 'On Hold' || next === 'Cancelled') setRunning(false)
  }

  const timeChosen = (Number(hrs) || 0) > 0 || (Number(mins) || 0) > 0 || elapsed > 0

  return (
    <div>
      <button onClick={onBack} style={styles.crumb}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        Back to work order
      </button>

      <div style={styles.grid}>
        {/* ── left: the job + status ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{wo.workOrderId}</div>
                <div style={{ fontSize: 12.5, color: SUB, marginTop: 3, overflowWrap: 'anywhere' }}>{wo._asset}</div>
              </div>
              <StatusBadge tone={STATUS_TONE[S]}>{S}</StatusBadge>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <Row k="Assigned to" v={wo.assignedTo || '—'} />
              <Row k="Site" v={wo._site || '—'} />
              <Row k="Priority" v={wo.priority || '—'} />
            </div>
          </Card>

          <Card>
            <div style={styles.h}>Change work order status</div>
            <select value={S} onChange={(e) => changeStatus(e.target.value)} style={styles.select}>
              <option value={S} disabled>{S} (current)</option>
              {(FLOW[S] || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(FLOW[S] || []).length === 0 && <div style={{ fontSize: 11.5, color: MUTE, marginTop: 8 }}>This work order is closed — no further transitions.</div>}
          </Card>

          <Card>
            <div style={styles.h}>Task execution</div>
            <Row k="Progress" v={`${doneCount} / ${tasks.length} tasks`} />
            <div style={styles.progressTrack}><div style={{ ...styles.progressFill, width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }} /></div>
            <Row k="Status" v={S} />
          </Card>
        </div>

        {/* ── centre: tasks + timer + complete ───────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...styles.banner, background: S === 'In Progress' ? '#eef6ff' : '#ecfdf5', borderColor: S === 'In Progress' ? '#bfdbfe' : '#a7f3d0' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>
              {S === 'In Progress' ? 'Work in progress' : S === 'Completed' ? 'Work completed' : 'Ready to start work'}
            </div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 3, lineHeight: 1.5 }}>
              {S === 'In Progress'
                ? 'Work the task list, keep the timer running, and complete the job when the work is done.'
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
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTask() }} placeholder="Add a task…" style={{ ...styles.input, flex: 1 }} />
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
              <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>Or log time manually and complete:</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label="Hours"><input value={hrs} onChange={(e) => setHrs(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" style={{ ...styles.input, width: 74 }} /></Field>
                <Field label="Minutes"><input value={mins} onChange={(e) => setMins(e.target.value.replace(/[^\d]/g, ''))} placeholder="30" style={{ ...styles.input, width: 74 }} /></Field>
                <div style={{ flex: 1 }} />
                <ActionButton variant="success" disabled={S === 'Completed' || !timeChosen} onClick={complete}>
                  Complete with logged time
                </ActionButton>
              </div>
              <div style={{ fontSize: 11, color: MUTE, marginTop: 8 }}>
                Completing logs {loggedMinutes()} min against {wo.workOrderId} and marks it Completed{allDone ? '' : ` (${tasks.length - doneCount} task${tasks.length - doneCount === 1 ? '' : 's'} still open)`}.
              </div>
            </div>
          </Card>
        </div>

        {/* ── right: assistant ───────────────────────────────────────────── */}
        <div>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={styles.aiDot} />
              <div style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>Synapse assistant</div>
            </div>
            <div style={{ fontSize: 11.5, color: MUTE, marginBottom: 12 }}>Guidance for this work order</div>
            <div style={styles.aiHeader}>Technician assistant · {wo.workOrderId}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <Bubble>Working on <b>{wo._asset}</b> at {wo._site}. Priority {wo.priority}.</Bubble>
              {wo.alertId
                ? <Bubble>This job was raised from alert <b>{wo.alertId}</b>. Confirm the reported condition before you begin, and note whether the physical finding matches the prediction — that feedback trains the model.</Bubble>
                : <Bubble>No condition alert preceded this job. Record what you find so it can be compared against the monitoring baseline.</Bubble>}
              <Bubble>Isolate to the OEM procedure, verify zero energy, and keep the redundant path in service where the criticality demands it.</Bubble>
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
      <span style={{ color: MUTE, flex: '0 0 96px' }}>{k}</span>
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
  grid: { display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) minmax(320px,1.5fr) minmax(240px,1fr)', gap: 14, alignItems: 'start' },
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
  banner: { border: '1px solid', borderRadius: 12, padding: '13px 15px' },
  task: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px', border: `1px solid ${LINE}`, borderRadius: 9, cursor: 'pointer' },
  rm: { width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', color: '#b91c1c', fontSize: 15, cursor: 'pointer', lineHeight: 1, flexShrink: 0 },
  progressTrack: { height: 7, borderRadius: 999, background: '#eef2f7', margin: '8px 0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, background: GREEN, transition: 'width .25s ease' },
  aiDot: { width: 9, height: 9, borderRadius: '50%', background: ACCENT, boxShadow: '0 0 0 3px #eef1ff' },
  aiHeader: { fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#1f2d92,#15227a)', borderRadius: 9, padding: '9px 11px' },
}
