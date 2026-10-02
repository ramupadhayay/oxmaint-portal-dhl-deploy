'use client'

// Raise a work order.
//
// The fields are the workbook's own columns, in its order, for the same reason
// the asset form uses its: the backlog this writes into is that table, and a
// form that asks for something the table cannot show — or misses something it
// can — produces a row of dashes sitting beside fifteen complete ones.
//
// Two things are filled in rather than asked for. The number continues the
// workbook's sequence from WO-2015, because a presenter reading "WO-2016" out
// loud should sound like the fifteen above it. And picking an asset fills in its
// department, since the workbook's own rows always agree on that pair and
// letting the two be set separately is how a loom ends up filed under Utilities.
//
// The AI estimate is offered rather than imposed. This portal has no model
// behind it — the estimates in the workbook were supplied — so the field carries
// the median of the same work type's actuals as a starting point and says so.
// Presenting a made-up number as the model's prediction would misrepresent the
// one feature the customer asked about by name.

import { useMemo, useState } from 'react'
import { Modal, ActionButton } from '../lib/kit'
import { assets, users, workOrders, WO_TYPES, WO_PRIORITIES, locName } from '../lib/data'
import { nextWorkOrderNo } from '../lib/store'

const STATUS = ['Open', 'In Progress', 'On Hold']
const UNASSIGNED = 'Unassigned'

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

/**
 * A starting figure for the estimate box: the median actual duration of
 * completed jobs of the same type, or the median of everything when that type
 * has never been completed. Median rather than mean because two of the fifteen
 * jobs ran well over and a mean would carry them into every suggestion.
 */
function suggestHours(type) {
  const pool = workOrders.filter((w) => w.actualHrs !== null && w.type === type)
  const rows = (pool.length ? pool : workOrders.filter((w) => w.actualHrs !== null))
    .map((w) => w.actualHrs)
    .sort((a, b) => a - b)
  if (!rows.length) return 2
  const mid = Math.floor(rows.length / 2)
  const median = rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2
  return Number(median.toFixed(1))
}

export default function AddWorkOrderModal({ open, onClose, onCreate, created = [], assetId = '' }) {
  const suggestedNo = useMemo(() => nextWorkOrderNo([...workOrders, ...created]), [created])

  const [form, setForm] = useState(() => blank(assetId))
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  function blank(seedAsset) {
    const type = 'Corrective'
    return {
      title: '',
      assetId: seedAsset || '',
      type,
      priority: 'Medium',
      status: 'Open',
      assignedTo: UNASSIGNED,
      requestedBy: '',
      dueDate: inDays(3),
      aiEstimateHrs: String(suggestHours(type)),
      description: '',
    }
  }

  const asset = form.assetId ? assets.find((a) => a.assetId === form.assetId) : null

  const set = (k) => (e) => {
    const v = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Changing the work type re-suggests the estimate, unless the presenter
      // has already typed over it.
      if (k === 'type' && String(f.aiEstimateHrs) === String(suggestHours(f.type))) {
        next.aiEstimateHrs = String(suggestHours(v))
      }
      return next
    })
  }

  const missingTitle = !form.title.trim()
  const missingAsset = !form.assetId
  const invalid = missingTitle || missingAsset

  const submit = async () => {
    setTouched(true)
    if (invalid) return
    setSaving(true)
    const hrs = Number(form.aiEstimateHrs)
    const ok = await onCreate({
      woNo: suggestedNo,
      title: form.title.trim(),
      assetId: form.assetId,
      // Taken from the asset rather than asked for, so the two can never
      // disagree the way they would if both were fields.
      locationCode: asset?.locationCode || '',
      type: form.type,
      priority: form.priority,
      status: form.status,
      assignedTo: form.assignedTo,
      requestedBy: form.requestedBy.trim() || 'Raised in portal',
      dateRequested: today(),
      dueDate: form.dueDate,
      dateCompleted: '',
      aiEstimateHrs: Number.isFinite(hrs) && hrs > 0 ? hrs : null,
      // A job raised now has not been done, so it has no actual. Zero would read
      // as "took no time" on the AI estimates screen rather than "not yet".
      actualHrs: null,
      description: form.description.trim(),
      _addedInPortal: true,
    })
    setSaving(false)
    if (ok) {
      setForm(blank(''))
      setTouched(false)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Raise work order" subtitle="Add a job to the backlog" width={640}>
      <div style={{ display: 'grid', gap: 13 }}>
        <div style={idRow}>
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Work order</span>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: '#15227a' }}>
            {suggestedNo}
          </span>
          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>continues the backlog&apos;s sequence</span>
        </div>

        <Field label="What needs doing" required error={touched && missingTitle ? 'Give the job a title.' : ''}>
          <input
            autoFocus
            value={form.title}
            onChange={set('title')}
            placeholder="Loom #4 — warp stop motion fault"
            style={input}
          />
        </Field>

        <Field label="Asset" required error={touched && missingAsset ? 'Every job is raised against a machine.' : ''}>
          <select value={form.assetId} onChange={set('assetId')} style={input}>
            <option value="">Select a machine…</option>
            {assets.map((a) => (
              <option key={a.assetId} value={a.assetId}>
                {a.assetId} — {a.name} ({a.category})
              </option>
            ))}
          </select>
          {asset && (
            <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 5 }}>
              {locName(asset.locationCode)} · {asset.manufacturer} {asset.model} · {asset.criticality} criticality
              {asset.status === 'Down' && <b style={{ color: '#b91c1c' }}> · currently down</b>}
            </span>
          )}
        </Field>

        <Row>
          <Field label="Type">
            <select value={form.type} onChange={set('type')} style={input}>
              {WO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={set('priority')} style={input}>
              {WO_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </Row>

        <Row>
          <Field label="Assign to">
            <select value={form.assignedTo} onChange={set('assignedTo')} style={input}>
              <option value={UNASSIGNED}>Unassigned — leave for a planner</option>
              {users.map((u) => (
                <option key={u.userId} value={u.name}>{u.name} — {u.team}</option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={form.dueDate} onChange={set('dueDate')} style={input} />
          </Field>
        </Row>

        <Row>
          <Field label="Requested by">
            <input
              value={form.requestedBy}
              onChange={set('requestedBy')}
              placeholder="Weaving Shift Lead"
              style={input}
            />
          </Field>
          <Field label="Estimated hours">
            <input
              type="number" min="0" step="0.5"
              value={form.aiEstimateHrs}
              onChange={set('aiEstimateHrs')}
              style={input}
            />
            <span style={{ display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 5, lineHeight: 1.5 }}>
              Suggested from the median actual on completed {form.type.toLowerCase()} jobs — not a
              model prediction.
            </span>
          </Field>
        </Row>

        <Field label="Detail">
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={3}
            placeholder="What was seen, and what the shift reported."
            style={{ ...input, resize: 'vertical', minHeight: 68 }}
          />
        </Field>

        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.55 }}>
          Saved against this portal rather than into the supplied workbook, so the sample data
          stays exactly as delivered. It survives a refresh.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 4 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Raise work order'}
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 13 }}>{children}</div>
}

function Field({ label, required, error, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {error && <span style={{ display: 'block', fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</span>}
    </label>
  )
}

const input = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
  border: '1px solid #e4e9f0', borderRadius: 9, outline: 'none',
  fontFamily: 'inherit', color: '#0f172a', background: '#fff',
}

const idRow = {
  display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
  padding: '10px 13px', background: '#f8fafc', border: '1px solid #eef1f6', borderRadius: 9,
}
