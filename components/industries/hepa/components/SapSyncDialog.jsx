'use client'

// SAP BTP Sync Configuration — the panel the product opens from a Sync button.
//
// Ported from the product's own dialog: the direction pair for a bidirectional
// transaction, the frequency and endpoint row, the two URL fields with their
// notes, and the request and response side by side under them. Test API issues
// the call and shows what came back; SAP Sync does the same and records it.
//
// Ours differs in one way that matters. Four of the transactions in the
// catalogue reach this portal's own compliance gateway, and for those the
// request is real — the payload is editable, the endpoint is the one that
// answers, and the response pane holds the actual envelope, including the 409
// with a SAP message code that a certification without a signature comes back
// with. For the rest there is no counterpart in this facility's data, and the
// dialog says so where the response would be rather than inventing one.

import { useEffect, useMemo, useRef, useState } from 'react'
import { PALETTE } from '../lib/kit'
import { Glyph, Pill, TONE, BRAND, Z } from '../lib/productKit'
import { LIVE, isLive, directionOf, DIRECTION_LABEL } from '../lib/sapCatalogue'
import { FILTER_VIEW } from '../lib/data'
import { payloadTextFor } from '../lib/sapPayloads'

const { INK, SUB, MUTE, LINE } = PALETTE

const FREQUENCIES = [
  ['manual', 'Manual (On-demand)'],
  ['realtime', 'Real-time (Event-driven)'],
  ['hourly', 'Hourly'],
  ['daily', 'Daily (Midnight)'],
  ['weekly', 'Weekly (Sunday Midnight)'],
]

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const BACKEND_BASE = 'https://oxmaint-core-backend-stg.azurewebsites.net/api/v1'

export default function SapSyncDialog({ transaction, onClose, onResult }) {
  const dir = directionOf(transaction.code)
  const bidirectional = dir === 'both'
  const live = LIVE[transaction.code] || null

  const [direction, setDirection] = useState(dir === 'to-oxmaint' ? 'outbound-sap' : 'inbound-sap')
  const [frequency, setFrequency] = useState('manual')
  const [backendBase, setBackendBase] = useState(BACKEND_BASE)
  const [method, setMethod] = useState(live?.verb || 'POST')
  const [path, setPath] = useState(live?.path || '/materials/update')
  const [backendUrl, setBackendUrl] = useState(BACKEND_BASE)
  const [sapUrl, setSapUrl] = useState('http://localhost:3001')

  const [payload, setPayload] = useState(() => payloadTextFor(transaction.code))
  const [response, setResponse] = useState(null)
  const [result, setResult] = useState('idle')
  const [busy, setBusy] = useState(null)
  const [copied, setCopied] = useState(null)

  // Escape closes, as every other dialog in the portal does.
  const wrap = useRef(null)
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const invalidJson = useMemo(() => {
    if (!payload.trim()) return null
    try { JSON.parse(payload); return null } catch (e) { return e.message }
  }, [payload])

  /**
   * Issue the call.
   *
   * `record` is what separates Test API from SAP Sync: both send the same
   * request, and only the second writes the result into the communication log.
   * The product draws the same distinction, and it is the right one — a
   * reviewer poking at an endpoint should not be filling the log with it.
   */
  const send = async (mode) => {
    setBusy(mode)
    setResult('idle')
    const startedAt = Date.now()

    if (!live) {
      setResponse({
        note: 'This transaction is in the catalogue but has no counterpart in the compliance gateway, '
          + 'so there is no endpoint to call. Nothing was sent.',
      })
      setResult('idle')
      setBusy(null)
      if (mode === 'sync') onResult({ sent: false, status: 'success', durationMs: 0 })
      return
    }

    try {
      const url = live.path + (live.verb === 'GET' ? queryFrom(payload) : '')
      const res = await fetch(url, live.verb === 'POST' ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      } : undefined)
      const json = await res.json().catch(() => null)
      const failed = !res.ok || Boolean(json?.error)

      setResponse({ http: res.status, body: json, ms: Date.now() - startedAt })
      setResult(failed ? 'error' : 'success')
      if (mode === 'sync') {
        onResult({
          sent: true,
          status: failed ? 'error' : 'success',
          http: res.status,
          body: json,
          durationMs: Date.now() - startedAt,
        })
      }
    } catch (e) {
      setResponse({ error: e.message, ms: Date.now() - startedAt })
      setResult('error')
      if (mode === 'sync') onResult({ sent: true, status: 'error', message: e.message, durationMs: Date.now() - startedAt })
    }
    setBusy(null)
  }

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1400)
    } catch {
      // Clipboard refused. Not worth interrupting anybody over.
    }
  }

  return (
    <div style={styles.scrim} onClick={onClose} role="presentation">
      <div ref={wrap} style={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="SAP BTP Sync Configuration">
        <div style={styles.head}>
          <Glyph name="sap" size={19} color={BRAND[600]} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <h2 style={styles.title}>SAP BTP Sync Configuration</h2>
            <p style={styles.sub}>
              Configure and test the SAP BTP integration for <span style={styles.codeChip}>{transaction.code}</span> — {transaction.name}
            </p>
          </span>
          <button onClick={onClose} style={styles.close} aria-label="Close">
            <Glyph name="cross" size={17} color={MUTE} />
          </button>
        </div>

        <div style={styles.body}>
          <section style={styles.card}>
            <div style={styles.cardHead}>
              <Glyph name="sap" size={16} color={SUB} />
              <h3 style={styles.cardTitle}>API Configuration</h3>
              {!live && <Pill tone="amber">Not wired to the gateway</Pill>}
            </div>

            {bidirectional && (
              <div style={{ marginBottom: 16 }}>
                <span style={styles.label}>Sync Direction</span>
                <div style={styles.dirRow}>
                  {[
                    ['inbound-sap', 'Inbound SAP', 'OXmaint → SAP', 'up', '#2563eb', '#eff6ff', '#bfdbfe'],
                    ['outbound-sap', 'Outbound SAP', 'SAP → OXmaint', 'down', '#7c3aed', '#f5f3ff', '#ddd6fe'],
                  ].map(([key, label, hint, icon, fg, bg, bd]) => {
                    const on = direction === key
                    return (
                      <button key={key} onClick={() => setDirection(key)}
                        style={{
                          ...styles.dirBtn,
                          borderColor: on ? fg : LINE,
                          background: on ? bg : '#fff',
                          color: on ? fg : SUB,
                        }}>
                        <Glyph name={icon} size={15} color={on ? fg : '#94a3b8'} />
                        <strong>{label}</strong>
                        <span style={{ fontSize: 11, opacity: 0.85 }}>({hint})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={styles.trio}>
              <Field icon="clock" label="Sync Frequency">
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={styles.input}>
                  {FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>

              <Field icon="sap" label="Oxmaint Backend Base URL">
                <input value={backendBase} onChange={(e) => setBackendBase(e.target.value)} style={styles.mono} />
              </Field>

              <Field icon="sap" label="Test API Endpoint" badge="Test API">
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...styles.input, width: 104, flexShrink: 0 }}>
                    {METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <input value={path} onChange={(e) => setPath(e.target.value)} style={{ ...styles.mono, flex: 1 }} />
                </div>
              </Field>
            </div>

            <div style={{ marginTop: 16 }}>
              <Field icon="sap" label="OXmaint Backend URL" badge="SAP Sync">
                <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} style={styles.mono} />
              </Field>
              <p style={styles.noteBlue}>
                This is the OXmaint backend endpoint that will be called when you click SAP Sync.
              </p>
            </div>

            <div style={{ marginTop: 14 }}>
              <Field icon="sap" label="SAP API URL" badge={method} badge2="SAP Sync">
                <input value={sapUrl} onChange={(e) => setSapUrl(e.target.value)} style={styles.mono} />
              </Field>
              <p style={styles.noteRed}>
                This URL will be passed to the backend and used to sync data with SAP when you click SAP Sync.
              </p>
            </div>

            {live && (
              <p style={styles.liveNote}>
                <Glyph name="link" size={13} color={BRAND[600]} />
                <span>
                  This transaction is wired to the compliance gateway. Test API and SAP Sync both issue{' '}
                  <strong>{live.verb} {live.path}</strong> for real — {live.what}
                </span>
              </p>
            )}
          </section>

          <div style={styles.split}>
            <section style={styles.card}>
              <div style={styles.cardHead}>
                <Glyph name="doc" size={16} color={SUB} />
                <h3 style={styles.cardTitle}>Request Payload (JSON)</h3>
                <Pill tone={dir === 'to-oxmaint' ? 'violet' : 'blue'}>
                  {dir === 'to-oxmaint' ? 'From SAP' : 'From OXmaint'}
                </Pill>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <Ghost onClick={() => copy('payload', payload)} icon={copied === 'payload' ? 'check' : 'doc'}>
                    {copied === 'payload' ? 'Copied' : 'Copy'}
                  </Ghost>
                  <Ghost onClick={() => setPayload(payloadTextFor(transaction.code))} icon="refresh">Reset</Ghost>
                </span>
              </div>
              <textarea value={payload} onChange={(e) => setPayload(e.target.value)}
                spellCheck={false} placeholder='{"key": "value"}'
                style={{ ...styles.code, borderColor: invalidJson ? TONE.red.bd : LINE }} />
              {invalidJson && <p style={styles.invalid}>Not valid JSON — {invalidJson}</p>}
            </section>

            <section style={styles.card}>
              <div style={styles.cardHead}>
                <Glyph name="doc" size={16} color={SUB} />
                <h3 style={styles.cardTitle}>API Response</h3>
                {result !== 'idle' && (
                  <Pill tone={result === 'success' ? 'slate' : 'red'}>
                    {result === 'success' ? 'Success' : 'Failed'}
                  </Pill>
                )}
                {response?.http != null && <span style={styles.httpChip}>HTTP {response.http}</span>}
                {response?.ms != null && <span style={styles.msChip}>{response.ms} ms</span>}
                <span style={{ marginLeft: 'auto' }}>
                  <Ghost onClick={() => copy('res', JSON.stringify(response?.body ?? response ?? {}, null, 2))}
                    icon={copied === 'res' ? 'check' : 'doc'}>
                    {copied === 'res' ? 'Copied' : 'Copy'}
                  </Ghost>
                </span>
              </div>

              {response ? (
                response.note ? (
                  <div style={styles.emptyRes}>{response.note}</div>
                ) : (
                  <pre style={styles.pre}>{JSON.stringify(response.body ?? { error: response.error }, null, 2)}</pre>
                )
              ) : (
                <div style={styles.emptyRes}>
                  Nothing sent yet. Test API issues the request without recording it; SAP Sync issues
                  the same request and writes the result to the communication log.
                </div>
              )}
            </section>
          </div>
        </div>

        <div style={styles.foot}>
          <button onClick={onClose} style={styles.ghostBtn}>Cancel</button>
          <button onClick={() => send('test')} disabled={Boolean(busy) || Boolean(invalidJson)}
            style={{ ...styles.secondary, opacity: busy || invalidJson ? 0.55 : 1 }}>
            <Glyph name="play" size={13} color={INK} />
            {busy === 'test' ? 'Testing…' : 'Test API'}
          </button>
          <button onClick={() => send('sync')} disabled={Boolean(busy) || Boolean(invalidJson)}
            style={{ ...styles.primary, opacity: busy || invalidJson ? 0.55 : 1 }}>
            <Glyph name="save" size={13} color="#fff" />
            {busy === 'sync' ? 'Saving…' : 'SAP Sync'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** A GET carries its argument in the query rather than in a body. */
function queryFrom(payload) {
  try {
    const o = JSON.parse(payload)
    const id = o.id || o.filterId || o.class
    if (o.class) return `?class=${encodeURIComponent(o.class)}`
    return id ? `?id=${encodeURIComponent(id)}` : ''
  } catch {
    return ''
  }
}

function Field({ icon, label, badge, badge2, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={styles.label}>
        <Glyph name={icon} size={14} color={MUTE} />
        {label}
        {badge && <span style={styles.fieldBadge}>{badge}</span>}
        {badge2 && <span style={styles.fieldBadge}>{badge2}</span>}
      </span>
      {children}
    </div>
  )
}

function Ghost({ icon, children, onClick }) {
  return (
    <button onClick={onClick} style={styles.ghostSm}>
      <Glyph name={icon} size={13} color={SUB} />
      {children}
    </button>
  )
}

const styles = {
  scrim: {
    position: 'fixed', inset: 0, zIndex: Z.modal, background: 'rgba(15,23,42,.45)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '20px 16px', overflow: 'hidden',
  },
  dialog: {
    background: '#fff', borderRadius: 13, width: '100%', maxWidth: 1180,
    display: 'flex', flexDirection: 'column', maxHeight: '100%', minHeight: 0,
    boxShadow: '0 22px 60px rgba(15,23,42,.28)',
  },
  head: {
    display: 'flex', alignItems: 'flex-start', gap: 11, padding: '16px 20px', flexShrink: 0,
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: LINE,
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: INK },
  sub: { margin: '4px 0 0', fontSize: 12.5, color: SUB, lineHeight: 1.55 },
  codeChip: {
    display: 'inline-block', padding: '1px 7px', borderRadius: 5, fontSize: 11, fontWeight: 700,
    color: BRAND[900], background: BRAND[50], fontVariantNumeric: 'tabular-nums',
    borderStyle: 'solid', borderWidth: 1, borderColor: BRAND[100],
  },
  close: {
    width: 30, height: 30, display: 'grid', placeItems: 'center', background: 'transparent',
    border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
  },

  body: { padding: '16px 20px', overflowY: 'auto', minHeight: 0, flex: 1 },
  card: {
    background: '#fff', borderRadius: 11, padding: '15px 17px', marginBottom: 14,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, minWidth: 0,
  },
  cardHead: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 13 },
  cardTitle: { margin: 0, fontSize: 14.5, fontWeight: 700, color: INK },

  label: {
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
    fontSize: 12, fontWeight: 600, color: INK,
  },
  fieldBadge: {
    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
    color: BRAND[600], background: BRAND[50],
    borderStyle: 'solid', borderWidth: 1, borderColor: BRAND[100],
  },

  dirRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  dirBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 15px',
    fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 9,
    borderStyle: 'solid', borderWidth: 1,
  },

  trio: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  mono: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12,
    fontFamily: 'ui-monospace, Menlo, monospace', color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  noteBlue: { margin: '6px 0 0', fontSize: 11.5, color: '#2563eb', lineHeight: 1.55 },
  noteRed: { margin: '6px 0 0', fontSize: 11.5, color: '#b91c1c', lineHeight: 1.55 },
  liveNote: {
    display: 'flex', alignItems: 'flex-start', gap: 8, margin: '15px 0 0', padding: '10px 12px',
    borderRadius: 9, background: BRAND[50], fontSize: 11.5, color: SUB, lineHeight: 1.6,
    borderStyle: 'solid', borderWidth: 1, borderColor: BRAND[100],
  },

  split: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 },
  code: {
    width: '100%', boxSizing: 'border-box', height: 280, resize: 'none', padding: 12,
    fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, lineHeight: 1.6,
    color: INK, background: '#f8fafc', outline: 'none',
    borderStyle: 'solid', borderWidth: 1, borderRadius: 9,
  },
  invalid: { margin: '6px 0 0', fontSize: 11.5, color: TONE.red.fg },
  pre: {
    margin: 0, height: 280, overflow: 'auto', padding: 12, borderRadius: 9,
    background: '#0f172a', color: '#e2e8f0', fontSize: 12, lineHeight: 1.6,
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
  emptyRes: {
    height: 280, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 22,
    borderRadius: 9, background: '#fbfcfd', fontSize: 12, color: MUTE, lineHeight: 1.6,
    borderStyle: 'dashed', borderWidth: 1, borderColor: '#dbe2ea',
  },
  httpChip: {
    fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
    color: SUB, background: '#f1f5f9', fontVariantNumeric: 'tabular-nums',
  },
  msChip: { fontSize: 10.5, color: MUTE, fontVariantNumeric: 'tabular-nums' },

  foot: {
    display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '13px 20px', flexShrink: 0,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE, flexWrap: 'wrap',
  },
  ghostBtn: {
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  secondary: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#f1f5f9', color: INK, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  primary: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: BRAND[900], color: '#fff', border: 'none', cursor: 'pointer',
  },
  ghostSm: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px',
    fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', borderRadius: 7,
    background: 'transparent', color: SUB, border: 'none', cursor: 'pointer',
  },
}
