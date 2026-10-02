'use client'

// Raise a purchase order.
//
// The fields are the Purchase_Orders sheet's own columns, in its order, for the
// same reason the asset and work order forms use theirs: the register this
// writes into is that table, and a form that asks for something the table cannot
// show produces a row of dashes sitting beside fifteen complete ones.
//
// Four things are filled in rather than asked for. The number continues the
// sequence from PO-3015. Choosing a part carries its catalogue supplier, its
// unit cost and its reorder quantity across, because every one of the fifteen
// supplied orders agrees with the catalogue on all three and letting them be
// typed separately is how a vendor ends up buying a part it does not sell. The
// line total is arithmetic and is shown rather than entered. And a new order has
// received nothing, so quantity received is zero and the received date is empty
// — not today's date, which would read as delivered on the register.
//
// "Raised for" is the field that makes this a relation rather than a note. The
// picker offers the two standing reasons the sheet uses and then every open job,
// schedule and asset by name, and writes a sentence containing that record's id
// — which is what the register resolves. Picking WO-2004 here is what makes the
// order appear on WO-2004's page, with no second link to maintain.

import { useMemo, useState } from 'react'
import { Modal, ActionButton } from '../lib/kit'
import {
  parts, assets, users, workOrders, pmSchedules, purchaseOrders,
  PO_OPEN_STATUSES, money, locName,
} from '../lib/data'
import { nextPoNo } from '../lib/store'

// Received and Cancelled are states an order reaches, not states it is raised
// in. Offering them here would let a presenter create an order that was already
// delivered before it existed.
const STATUSES = PO_OPEN_STATUSES.filter((s) => s !== 'Partially Received')

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

// The two standing reasons in the supplied sheet, kept as literals so an order
// raised in a demo reads like the ones above it.
const PLAIN = ['Routine restock', 'Reorder point reached']

/** The sentence written into Linked To, built so the id inside it resolves. */
function reasonSentence(choice, note) {
  const trimmed = note.trim()
  const tail = trimmed ? ` (${trimmed})` : ''
  if (!choice) return trimmed || 'Routine restock'
  if (PLAIN.includes(choice)) return `${choice}${tail}`

  if (/^WO-/.test(choice)) {
    const w = workOrders.find((x) => x.woNo === choice)
    return `Spare stock for ${choice}${tail || (w ? ` (${w.title})` : '')}`
  }
  if (/^PM-/.test(choice)) {
    const p = pmSchedules.find((x) => x.pmId === choice)
    return `Linked to ${choice}${tail || (p ? ` (${p.task})` : '')}`
  }
  const a = assets.find((x) => x.assetId === choice)
  return `Raised for ${choice}${tail || (a ? ` (${a.name})` : '')}`
}

export default function AddPurchaseOrderModal({ open, onClose, onCreate, created = [], partNo = '' }) {
  const suggestedNo = useMemo(
    () => nextPoNo([...purchaseOrders, ...created]),
    [created]
  )

  const [form, setForm] = useState(() => blank(partNo))
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  // Re-seeded whenever the modal is opened from a particular shortage, so
  // "Raise order" on the FR finish chemical opens with that part already chosen
  // rather than making the presenter find it in a list of twenty.
  const [seed, setSeed] = useState(partNo)
  if (open && partNo !== seed) {
    setSeed(partNo)
    setForm(blank(partNo))
    setTouched(false)
  }

  function blank(seedPart) {
    const p = seedPart ? parts.find((x) => x.partNo === seedPart) : null
    return {
      partNo: seedPart || '',
      qtyOrdered: p ? String(p.reorderQty || 1) : '',
      unitCost: p ? String(p.unitCost) : '',
      vendor: p ? p.supplier : '',
      status: 'Draft',
      requestedBy: '',
      expectedDate: inDays(7),
      reason: seedPart ? 'Reorder point reached' : 'Routine restock',
      note: '',
    }
  }

  const part = form.partNo ? parts.find((p) => p.partNo === form.partNo) : null

  const qty = Number(form.qtyOrdered)
  const cost = Number(form.unitCost)
  const validQty = Number.isFinite(qty) && qty > 0
  const validCost = Number.isFinite(cost) && cost > 0
  const total = validQty && validCost ? Number((qty * cost).toFixed(2)) : 0

  const set = (k) => (e) => {
    const v = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Choosing a part carries the catalogue across — but only over values the
      // presenter has not already typed over, so a negotiated price survives a
      // change of mind about the quantity.
      if (k === 'partNo') {
        const p = parts.find((x) => x.partNo === v)
        const prev = f.partNo ? parts.find((x) => x.partNo === f.partNo) : null
        if (p) {
          if (!f.vendor || f.vendor === prev?.supplier) next.vendor = p.supplier
          if (!f.unitCost || Number(f.unitCost) === prev?.unitCost) next.unitCost = String(p.unitCost)
          if (!f.qtyOrdered || Number(f.qtyOrdered) === prev?.reorderQty) next.qtyOrdered = String(p.reorderQty || 1)
        }
      }
      return next
    })
  }

  const missingPart = !form.partNo
  const missingVendor = !form.vendor.trim()
  const invalid = missingPart || missingVendor || !validQty || !validCost

  const openJobs = workOrders.filter((w) => w._open)

  const submit = async () => {
    setTouched(true)
    if (invalid) return
    setSaving(true)
    const ok = await onCreate({
      poNo: suggestedNo,
      partNo: form.partNo,
      // Taken from the catalogue rather than asked for, so the register's part
      // column and the catalogue can never disagree.
      partName: part?.name || form.partNo,
      vendor: form.vendor.trim(),
      qtyOrdered: qty,
      unitCost: cost,
      totalCost: total,
      status: form.status,
      orderDate: today(),
      expectedDate: form.expectedDate,
      // Nothing has arrived against an order raised a second ago. Empty rather
      // than today, which the register would read as delivered.
      receivedDate: '',
      qtyReceived: 0,
      requestedBy: form.requestedBy.trim() || 'Raised in portal',
      linkedTo: reasonSentence(form.reason, form.note),
      _addedInPortal: true,
    })
    setSaving(false)
    if (ok) {
      setForm(blank(''))
      setSeed('')
      setTouched(false)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Raise purchase order" subtitle="Order against the parts catalogue" width={660}>
      <div style={{ display: 'grid', gap: 13 }}>
        <div style={idRow}>
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Purchase order</span>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: '#15227a' }}>
            {suggestedNo}
          </span>
          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>continues the register&apos;s sequence</span>
        </div>

        <Field label="Part" required error={touched && missingPart ? 'Every order is raised against a catalogue line.' : ''}>
          <select autoFocus value={form.partNo} onChange={set('partNo')} style={input}>
            <option value="">Select a part…</option>
            {parts.map((p) => (
              <option key={p.partNo} value={p.partNo}>
                {p.partNo} — {p.name} ({p.qtyOnHand} on hand)
              </option>
            ))}
          </select>
          {part && (
            <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 5, lineHeight: 1.5 }}>
              {part.qtyOnHand} on hand against a reorder point of {part.reorderPoint} · {part._storeroomName}
              {part._incoming > 0 && <> · {part._incoming} already on the way</>}
              {part.qtyOnHand <= part.reorderPoint && <b style={{ color: '#b45309' }}> · below its reorder point</b>}
            </span>
          )}
        </Field>

        <Row>
          <Field label="Quantity" required error={touched && !validQty ? 'A quantity above zero.' : ''}>
            <input type="number" min="1" step="1" value={form.qtyOrdered} onChange={set('qtyOrdered')} style={input} />
            {part && (
              <span style={{ display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>
                Catalogue reorder quantity is {part.reorderQty}.
              </span>
            )}
          </Field>
          <Field label="Unit cost (USD)" required error={touched && !validCost ? 'A unit cost above zero.' : ''}>
            <input type="number" min="0" step="0.01" value={form.unitCost} onChange={set('unitCost')} style={input} />
            {part && Number(form.unitCost) !== part.unitCost && validCost && (
              <span style={{ display: 'block', fontSize: 10.5, color: '#b45309', marginTop: 5 }}>
                Catalogue price is {money(part.unitCost)}.
              </span>
            )}
          </Field>
        </Row>

        <div style={idRow}>
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Order value</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {total ? money(total) : '—'}
          </span>
          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
            {validQty && validCost ? `${qty} × ${money(cost)}` : 'quantity × unit cost'}
          </span>
        </div>

        <Row>
          <Field label="Vendor" required error={touched && missingVendor ? 'Name the supplier.' : ''}>
            <input value={form.vendor} onChange={set('vendor')} placeholder="Groz-Beckert" style={input} />
            {part && form.vendor.trim() && form.vendor.trim() !== part.supplier && (
              <span style={{ display: 'block', fontSize: 10.5, color: '#b45309', marginTop: 5 }}>
                Catalogue supplier for this part is {part.supplier}.
              </span>
            )}
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')} style={input}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </Row>

        <Row>
          <Field label="Raised by">
            <select value={form.requestedBy} onChange={set('requestedBy')} style={input}>
              <option value="">Raised in portal</option>
              {users.map((u) => (
                <option key={u.userId} value={u.name}>{u.name} — {u.role}</option>
              ))}
            </select>
          </Field>
          <Field label="Expected delivery">
            <input type="date" value={form.expectedDate} onChange={set('expectedDate')} style={input} />
          </Field>
        </Row>

        <Field label="Raised for">
          <select value={form.reason} onChange={set('reason')} style={input}>
            {PLAIN.map((r) => <option key={r} value={r}>{r}</option>)}
            {openJobs.length > 0 && (
              <optgroup label="Against an open work order">
                {openJobs.map((w) => (
                  <option key={w.woNo} value={w.woNo}>{w.woNo} — {w.title}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Against a PM schedule">
              {pmSchedules.map((p) => (
                <option key={p.pmId} value={p.pmId}>{p.pmId} — {p.task}</option>
              ))}
            </optgroup>
            <optgroup label="For an asset">
              {assets.map((a) => (
                <option key={a.assetId} value={a.assetId}>
                  {a.assetId} — {a.name} ({locName(a.locationCode)})
                </option>
              ))}
            </optgroup>
          </select>
          <span style={{ display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 5, lineHeight: 1.5 }}>
            {PLAIN.includes(form.reason)
              ? 'A standing reason. Pick a job, schedule or machine instead and the order will appear on that record too.'
              : <>The order will be listed on <b>{form.reason}</b> as well as here.</>}
          </span>
        </Field>

        <Field label="Note">
          <input
            value={form.note}
            onChange={set('note')}
            placeholder="Customer batch #4471 (FR denim order)"
            style={input}
          />
          <span style={{ display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>
            Reads as: {reasonSentence(form.reason, form.note)}
          </span>
        </Field>

        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.55 }}>
          Saved against this portal rather than into the supplied workbook, so the sample data
          stays exactly as delivered. It survives a refresh.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 4 }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Raise purchase order'}
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
