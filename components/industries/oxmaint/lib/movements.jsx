'use client'

// The stock ledger.
//
// Until now a part had a quantity and nothing in the product could change it:
// completing a job, receiving a purchase order and counting a bin all left the
// stockroom exactly as they found it. Every quantity the portal shows is now the
// seeded figure plus the sum of everything that has moved since.
//
// That sum is computed here and nowhere else, because the failure mode of
// spreading it out is specific and ugly: a screen showing a freshly consumed
// quantity next to the status the part had before it was consumed. Quantity,
// status and value are all recomputed together, from the same number, or none of
// them are.
//
// A movement is a record like any other, which is what makes the ledger an audit
// trail rather than a counter: who moved what, when, why, and against which job.

import { useCallback, useMemo, useState } from 'react'
import { Modal, ActionButton, PALETTE } from './kit'
import { useRecords, useStore } from './store'
import { PARTS, USER, SEEDED_STOCK_MOVES, fmtDate } from './data'

const { INK, SUB, MUTE, LINE, ACCENT, GREEN, RED } = PALETTE

export const MOVEMENT_KIND = 'stock_movement'

// Why stock moved. Free text here would leave the ledger unsortable and every
// demo run worded differently; these are the reasons a stores clerk actually
// has to choose between.
export const ISSUE_REASONS = [
  'Issued to work order', 'Issued to production', 'Damaged in stores',
  'Stock count correction', 'Transferred to another site',
]
export const RECEIVE_REASONS = [
  'Goods received', 'Returned unused from job', 'Stock count correction',
  'Transferred in from another site',
]

const partIdOf = (p) => p.part_id || p.recordId

const statusFor = (qty, min) => (qty === 0 ? 'Out of Stock' : qty < min ? 'Low Stock' : 'In Stock')

/**
 * The live stock position, and the two verbs that change it.
 *
 * `levels` is the parts catalogue — seeded parts, plus any added through the
 * form — with the ledger applied on top. It is what every inventory screen
 * should read from; raw PARTS is the opening balance, not the position.
 */
export function useStock() {
  const store = useStore()
  const catalogue = useRecords('part', PARTS, partIdOf)
  const ledger = store?.records?.[MOVEMENT_KIND]

  // Booked here, and what the stores had already posted. Both are the ledger a
  // clerk reads; only the first changes the position, because the opening
  // quantity already includes the second.
  const movements = useMemo(
    () => [...(ledger || []), ...SEEDED_STOCK_MOVES]
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))),
    [ledger],
  )

  const net = useMemo(() => {
    const out = new Map()
    ;(ledger || []).forEach((m) => {
      out.set(m.part_id, (out.get(m.part_id) || 0) + (Number(m.qty) || 0))
    })
    return out
  }, [ledger])

  const levels = useMemo(() => catalogue.map((p) => {
    const id = partIdOf(p)
    const opening = Number(p.quantity_on_hand) || 0
    const moved = net.get(id) || 0
    // Clamped at zero. Both writers already refuse to go below it, so a negative
    // here could only come from a hand-edited record — and a bin showing -3
    // reads as broken arithmetic rather than as bad data.
    const qty = Math.max(0, opening + moved)
    const min = Number(p.minimum_quantity) || 0
    const cost = Number(p.unit_cost) || 0
    return {
      ...p,
      quantity_on_hand: qty,
      total_value: Number((qty * cost).toFixed(2)),
      status: statusFor(qty, min),
      opening_quantity: opening,
      movement_net: moved,
    }
  }), [catalogue, net])

  const byId = useMemo(() => new Map(levels.map((p) => [partIdOf(p), p])), [levels])

  const levelOf = useCallback((partId) => byId.get(partId)?.quantity_on_hand ?? 0, [byId])

  const movementsFor = useCallback(
    (partId) => movements.filter((m) => m.part_id === partId),
    [movements],
  )

  const post = useCallback(async (partId, signed, reason, reference) => {
    const part = byId.get(partId)
    if (!part || !signed) return false
    const saved = await store?.create(MOVEMENT_KIND, {
      part_id: partId,
      part_name: part.part_name,
      qty: signed,
      reason: reason || '',
      reference: reference || '',
      site_id: part.site_id || '',
      at: new Date().toISOString(),
      by_name: USER.name,
    })
    return Boolean(saved)
  }, [byId, store])

  /**
   * Take stock out. Refuses rather than going negative, and names the part when
   * it does — "insufficient stock" on a screen listing eight lines tells the
   * user nothing they can act on.
   */
  const issue = useCallback(async (partId, qty, reason, reference) => {
    const part = byId.get(partId)
    const n = Math.abs(Math.floor(Number(qty) || 0))
    if (!part) {
      store?.notify('That part is not in the catalogue.', 'error')
      return false
    }
    if (!n) {
      store?.notify('Enter a quantity to issue.', 'error')
      return false
    }
    if (n > part.quantity_on_hand) {
      store?.notify(
        `Only ${part.quantity_on_hand} ${part.unit} of ${part.part_name} on hand — cannot issue ${n}.`,
        'error',
      )
      return false
    }
    return post(partId, -n, reason, reference)
  }, [byId, post, store])

  /** Put stock back in. */
  const receive = useCallback(async (partId, qty, reason, reference) => {
    const n = Math.abs(Math.floor(Number(qty) || 0))
    if (!n) {
      store?.notify('Enter a quantity to receive.', 'error')
      return false
    }
    return post(partId, n, reason, reference)
  }, [post, store])

  return { levels, movements, issue, receive, levelOf, movementsFor }
}

// ── shared inventory UI ──────────────────────────────────────────────────
// Parts and Stocks are the same records seen two ways, so the one thing that
// writes to them is shared rather than written twice and drifting apart.

export function MovementList({ rows = [], limit = 8, empty = 'No movements recorded yet.' }) {
  if (!rows.length) {
    return <p style={{ margin: 0, fontSize: 12.5, color: MUTE }}>{empty}</p>
  }
  return (
    <div>
      {rows.slice(0, limit).map((m) => (
        <div key={m.recordId} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${LINE}`,
        }}>
          <span style={{
            minWidth: 42, textAlign: 'right', fontSize: 12.5, fontWeight: 800,
            color: m.qty < 0 ? RED : GREEN,
          }}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.reason || 'Adjustment'}{m.reference ? ` · ${m.reference}` : ''}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: MUTE }}>{m.by_name} · {fmtDate(m.at)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Issue or receive against one part.
 *
 * `part` must be a row from `levels`, not from PARTS — the whole point of the
 * preview line is that it counts down from the quantity that is actually there.
 */
export function AdjustStockModal({ part, open, onClose, icon }) {
  const { issue, receive } = useStock()
  const [direction, setDirection] = useState('issue')
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState(ISSUE_REASONS[0])
  const [reference, setReference] = useState('')

  // A fresh form for each part, in the render pass rather than an effect, so the
  // previous part's quantity is never briefly shown against this one.
  const formKey = `${part ? partIdOf(part) : ''}-${open}`
  const [seenKey, setSeenKey] = useState(formKey)
  if (formKey !== seenKey) {
    setSeenKey(formKey)
    setDirection('issue')
    setQty('1')
    setReason(ISSUE_REASONS[0])
    setReference('')
  }

  if (!part) return null

  const onHand = Number(part.quantity_on_hand) || 0
  const min = Number(part.minimum_quantity) || 0
  const n = Math.max(0, Math.floor(Number(qty) || 0))
  const after = direction === 'issue' ? onHand - n : onHand + n
  const short = direction === 'issue' && n > onHand

  const submit = async () => {
    const done = direction === 'issue'
      ? await issue(partIdOf(part), n, reason, reference)
      : await receive(partIdOf(part), n, reason, reference)
    if (!done) return
    onClose()
  }

  return (
    <Modal
      open={open} onClose={onClose} icon={icon}
      title="Adjust stock"
      subtitle={`${part.part_name} — ${part.part_number}`}
      width={470}
      footer={
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant={direction === 'issue' ? 'primary' : 'success'} disabled={!n || short} onClick={submit}>
            {direction === 'issue' ? 'Issue' : 'Receive'} {n || ''} {part.unit}
          </ActionButton>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['issue', 'Issue out'], ['receive', 'Receive in']].map(([value, label]) => (
            <button key={value} type="button"
              onClick={() => {
                setDirection(value)
                setReason(value === 'issue' ? ISSUE_REASONS[0] : RECEIVE_REASONS[0])
              }}
              style={{
                flex: 1, padding: '9px 12px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                cursor: 'pointer', borderRadius: 9,
                border: `1px solid ${direction === value ? ACCENT : LINE}`,
                background: direction === value ? '#eef1ff' : '#fff',
                color: direction === value ? ACCENT : SUB,
              }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={fieldLabel}>Quantity ({part.unit})</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Reference</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="WO-2601, PO-4102…" style={fieldInput} />
          </div>
        </div>

        <div>
          <label style={fieldLabel}>Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} style={fieldInput}>
            {(direction === 'issue' ? ISSUE_REASONS : RECEIVE_REASONS).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
          borderRadius: 10, background: '#f8fafc', border: `1px solid ${LINE}`,
        }}>
          <span style={{ fontSize: 12, color: SUB, fontWeight: 600 }}>On hand</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: INK }}>{onHand}</span>
          <span style={{ fontSize: 13, color: MUTE }}>→</span>
          <span style={{
            fontSize: 15, fontWeight: 800,
            color: short ? RED : Math.max(0, after) === 0 ? RED : Math.max(0, after) < min ? '#b45309' : GREEN,
          }}>{Math.max(0, after)}</span>
          <span style={{ fontSize: 12, color: MUTE }}>{part.unit} · reorder at {min}</span>
        </div>

        {short && (
          <p style={{
            margin: 0, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5, borderRadius: 9,
            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          }}>
            Only {onHand} {part.unit} of {part.part_name} on hand. Reduce the quantity or receive stock first.
          </p>
        )}
      </div>
    </Modal>
  )
}

export const fieldLabel = {
  display: 'block', fontSize: 10, fontWeight: 700, color: MUTE,
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
}

export const fieldInput = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12.5, fontWeight: 600,
  border: `1px solid ${LINE}`, borderRadius: 9, background: '#fff', color: INK,
  fontFamily: 'inherit', outline: 'none',
}
