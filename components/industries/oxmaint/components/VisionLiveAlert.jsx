'use client'

// A critical detection, live, and the two things you do about it.
//
// The estate grid tells you a camera found something. It does not interrupt you,
// and a guard door open on a running machine is exactly the thing that should.
// So the highest-severity live detection gets a red band across the top of the
// screen, and the band carries the only two moves that matter: deal with it, and
// tell the people who need to know.
//
// DEALING WITH IT MEANS A REAL WORK ORDER. "Acknowledge" on its own is a button
// that makes an alert quieter without making a plant safer. Raising a job puts
// the finding into the same queue as every other piece of work, where it can be
// assigned, chased and closed — the CMMS this portal already is. The work order
// is written through the store under the ordinary `work_order` kind, so it turns
// up on Work Orders and on My Tasks like anything else.
//
// TELLING PEOPLE IS FOUR ROLES, NOT A MAILING LIST. Operator, supervisor,
// maintenance manager and plant head are different decisions: the operator stops
// the machine, the supervisor covers the shift, the manager funds the fix, the
// head hears about it if it is reportable. Severity pre-selects who is
// obviously needed and the raiser can change it, because the model does not know
// who is on site today.
//
// The escalation is recorded, not sent. This build has no mail or SMS gateway,
// and a screen that says "notified" when nothing left the building is the one
// lie on this page that could get somebody hurt. The record says who was listed,
// by whom, and when — and the confirmation says plainly that it is a record.

import { useState } from 'react'
import {
  Modal, ActionButton, StatusBadge, StatusDot, PALETTE,
} from '../lib/kit'
import { SEVERITY_COLOR } from '../lib/visionScenes'

const { ACCENT, INK, SUB, MUTE, LINE, RED } = PALETTE

// Who gets told, and what each of them is being asked to do. The description is
// not decoration — it is what stops "notify everybody" being the default.
export const ROLES = [
  { id: 'operator', label: 'Operator', who: 'On the machine now', does: 'Stop or isolate the equipment' },
  { id: 'supervisor', label: 'Shift Supervisor', who: 'Running the shift', does: 'Cover the line and confirm the area is clear' },
  { id: 'manager', label: 'Maintenance Manager', who: 'Owns the fix', does: 'Assign the work and release the spend' },
  { id: 'head', label: 'Plant Head', who: 'Accountable', does: 'Told when an event is reportable or stops production' },
]

// Severity decides who is obviously needed; the raiser decides the rest.
const PRESELECT = {
  Critical: ['operator', 'supervisor', 'manager'],
  High: ['operator', 'supervisor'],
  Medium: ['supervisor'],
  Low: [],
}

export default function VisionLiveAlert({ alert, onOpenCamera, onResolve, onDismiss }) {
  const [acting, setActing] = useState(false)

  if (!alert) return null
  const c = SEVERITY_COLOR[alert.severity] || RED

  return (
    <>
      <div style={{ ...styles.band, borderColor: c, background: alert.severity === 'Critical' ? '#fef2f2' : '#fffbeb' }}>
        <span style={{ ...styles.pulseWrap, background: `${c}1a` }}>
          <StatusDot color={c} pulse />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ ...styles.sev, background: c }}>{alert.severity}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{alert.label}</span>
            <span style={{ fontSize: 11.5, color: SUB }}>{alert.conf}% confidence</span>
          </div>
          <div style={{ fontSize: 12, color: SUB }}>
            <b style={{ color: INK }}>{alert.camera}</b> · {alert.view} · {alert.location} · detected just now
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <ActionButton size="sm" variant="ghost" onClick={onOpenCamera}>View camera</ActionButton>
          <ActionButton size="sm" variant="danger" onClick={() => setActing(true)}>Take action</ActionButton>
          <button onClick={onDismiss} title="Dismiss without acting" style={styles.x}>✕</button>
        </div>
      </div>

      {acting && (
        <ActionDialog
          alert={alert}
          onClose={() => setActing(false)}
          onSubmit={async (payload) => {
            await onResolve(payload)
            setActing(false)
          }}
        />
      )}
    </>
  )
}

function ActionDialog({ alert, onClose, onSubmit }) {
  const [raiseWo, setRaiseWo] = useState(true)
  const [roles, setRoles] = useState(() => new Set(PRESELECT[alert.severity] || []))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (id) => setRoles((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const chosen = ROLES.filter((r) => roles.has(r.id))
  // Doing neither is not an action, and the button says so rather than writing
  // an empty record that reads as a response.
  const canSubmit = raiseWo || chosen.length > 0

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Act on this detection"
      subtitle={`${alert.label} · ${alert.camera}`}
      width={600}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', width: '100%' }}>
          <span style={{ fontSize: 11, color: MUTE }}>
            {raiseWo ? 'Raises a work order' : 'No work order'}
            {chosen.length ? ` · notifies ${chosen.length}` : ' · notifies nobody'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton variant="ghost" onClick={onClose} disabled={busy}>Cancel</ActionButton>
            <ActionButton
              variant="danger"
              disabled={!canSubmit || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onSubmit({
                    raiseWorkOrder: raiseWo,
                    notify: chosen.map((r) => ({ id: r.id, label: r.label })),
                    note: note.trim(),
                  })
                } finally { setBusy(false) }
              }}
            >
              Confirm
            </ActionButton>
          </div>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...styles.summary, borderLeftColor: SEVERITY_COLOR[alert.severity] || RED }}>
          <Row k="Detection" v={alert.label} />
          <Row k="Severity · confidence" v={`${alert.severity} · ${alert.conf}%`} />
          <Row k="Camera" v={`${alert.camera} — ${alert.view}`} />
          <Row k="Location" v={alert.location} last />
        </div>

        <label style={{ ...styles.check, borderColor: raiseWo ? '#c7d2fe' : LINE, background: raiseWo ? '#f5f7ff' : '#fff' }}>
          <input type="checkbox" checked={raiseWo} onChange={(e) => setRaiseWo(e.target.checked)} style={styles.box} />
          <span style={{ minWidth: 0 }}>
            <span style={styles.checkTitle}>Raise a work order</span>
            <span style={styles.checkBody}>
              Files a {alert.severity === 'Critical' ? 'Critical' : 'High'} corrective job against{' '}
              {alert.assetName || 'the equipment in frame'}, assigned to nobody yet. It appears on Work
              Orders and on My Tasks like any other job.
            </span>
          </span>
        </label>

        <div>
          <div style={styles.groupTitle}>Inform</div>
          <p style={styles.groupNote}>
            Four different decisions, not one mailing list. {alert.severity} pre-selects who is
            obviously needed — change it, because the model does not know who is on site today.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {ROLES.map((r) => {
              const on = roles.has(r.id)
              return (
                <label
                  key={r.id}
                  style={{ ...styles.check, borderColor: on ? '#c7d2fe' : LINE, background: on ? '#f5f7ff' : '#fff' }}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(r.id)} style={styles.box} />
                  <span style={{ minWidth: 0 }}>
                    <span style={styles.checkTitle}>
                      {r.label}
                      <span style={{ fontWeight: 500, color: MUTE, marginLeft: 7 }}>{r.who}</span>
                    </span>
                    <span style={styles.checkBody}>{r.does}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <label style={{ display: 'block' }}>
          <span style={styles.groupTitle}>Note (optional)</span>
          <textarea
            rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="What you saw, and what you did about it."
            style={styles.textarea}
          />
        </label>

        <p style={styles.caveat}>
          Escalation is <b>recorded, not sent</b>. This build has no mail or SMS gateway, so confirming
          writes who was listed, by whom and when — it does not deliver a message. A screen that said
          &ldquo;notified&rdquo; when nothing left the building is the one claim on this page that
          could get somebody hurt.
        </p>
      </div>
    </Modal>
  )
}

function Row({ k, v, last }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: last ? 'none' : `1px solid ${LINE}` }}>
      <span style={{ fontSize: 11.5, color: MUTE, flex: '0 0 150px' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: INK, fontWeight: 600, minWidth: 0 }}>{v}</span>
    </div>
  )
}

const styles = {
  band: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
    padding: '11px 14px', borderRadius: 12,
    borderStyle: 'solid', borderWidth: 1.5,
    borderLeftWidth: 4,
  },
  pulseWrap: {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  sev: {
    padding: '2px 8px', borderRadius: 999, fontSize: 10,
    fontWeight: 800, color: '#fff', letterSpacing: 0.3,
  },
  x: {
    width: 28, height: 28, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
    background: '#fff', color: MUTE, fontSize: 12, fontFamily: 'inherit',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  summary: {
    padding: '10px 13px', borderRadius: 10, background: '#f8fafc',
    borderLeftStyle: 'solid', borderLeftWidth: 3,
  },
  check: {
    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, transition: 'background .12s, border-color .12s',
  },
  box: { width: 15, height: 15, marginTop: 2, flexShrink: 0, accentColor: ACCENT, cursor: 'pointer' },
  checkTitle: { display: 'block', fontSize: 12.5, fontWeight: 700, color: INK },
  checkBody: { display: 'block', fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.5 },
  groupTitle: { display: 'block', fontSize: 12, fontWeight: 700, color: INK, marginBottom: 5 },
  groupNote: { margin: '0 0 9px', fontSize: 11.5, color: MUTE, lineHeight: 1.55 },
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: INK, background: '#fff', borderRadius: 9, outline: 'none',
    resize: 'vertical', borderStyle: 'solid', borderWidth: 1, borderColor: '#e2e8f0',
  },
  caveat: {
    margin: 0, padding: '9px 12px', borderRadius: 9, background: '#fffbeb',
    fontSize: 11.5, color: '#92400e', lineHeight: 1.6,
    borderLeftStyle: 'solid', borderLeftWidth: 3, borderLeftColor: '#f59e0b',
  },
}
