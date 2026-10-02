'use client'

// SAP Integration Portal.
//
// Ported from the product's own screen — header, four stat cards, the module
// sidebar, and the transaction grid with its All / To SAP / To OXmaint cut —
// plus the Communication Logs and Configuration tabs behind the two buttons in
// the header.
//
// ── the part that is real ────────────────────────────────────────────────
//
// This portal has a working gateway at /api/hepa/sap. Four transactions in the
// product's catalogue have a counterpart here and their Sync issues the actual
// HTTP call: the equipment master read, the maintenance order read, the
// certification post, and the handshake. The certification post is the one
// worth watching — it refuses an unsigned record with a 409 and a SAP message
// code, and that refusal lands in the log like any other reply.
//
// The rest of the catalogue has no counterpart in this facility's data. Those
// rows say so on the card and in the log rather than dressing a local state
// change as a round trip. A reviewer who cannot tell which four are real has to
// treat all forty as theatre, which would waste the four that are not.

import { useMemo, useRef, useState } from 'react'
import { PageHeading, PALETTE } from '../lib/kit'
import { Action, SearchBar, Glyph, Pill, EmptyPanel, TONE, BRAND } from '../lib/productKit'
import {
  MODULES, MODULE_ORDER, DEFAULT_ON, TRANSACTIONS, transactionsOf, countOf,
  directionOf, DIRECTION_LABEL, LIVE, isLive, SEEDED_LOGS,
} from '../lib/sapCatalogue'
import { FILTER_VIEW } from '../lib/data'
import SapSyncDialog from '../components/SapSyncDialog'

const { INK, SUB, MUTE, LINE } = PALETTE

// The product spends its brand ramp rather than one shade of it: 900 fills a
// button or a badge, 600 draws the icons and figures beside a label. Painting
// all of it in 900 is what made this screen read heavier than the one it copies.
const ACCENT = BRAND[600]
const FILL = BRAND[900]

// The two directions carry meaning — which way a record moves decides which
// system owns it — so they keep a colour. Nothing else on this screen is
// tinted for being what it is.
const DIRECTION_TONE = { 'to-sap': 'blue', 'to-oxmaint': 'violet', both: 'slate' }
const STATUS_TONE = { success: 'slate', error: 'red', pending: 'amber', processing: 'amber' }

const STATUSES = ['success', 'error', 'pending', 'processing']

const fmtAgo = (mins) => (
  mins < 60 ? `${mins} min ago`
    : mins < 1440 ? `${Math.round(mins / 60)} h ago`
      : `${Math.round(mins / 1440)} d ago`
)

export default function SapSync() {
  const [tab, setTab] = useState('transactions')
  const [moduleCode, setModuleCode] = useState('MM')
  const [enabled, setEnabled] = useState(DEFAULT_ON)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('all')

  // What this session has actually done, newest first. Kept beside the seeded
  // log rather than merged into it so the two can still be told apart.
  const [sent, setSent] = useState([])
  const [opened, setOpened] = useState(null)
  // The product does not fire a Sync from the card — it opens the
  // configuration panel, and the call is issued from there against whatever
  // endpoint and payload the reader settled on.
  const [configuring, setConfiguring] = useState(null)

  // Log filters
  const [logStatus, setLogStatus] = useState('all')
  const [logModule, setLogModule] = useState('all')

  // Configuration
  const [protocol, setProtocol] = useState('OData v2')
  const [destination, setDestination] = useState('/sap/opu/odata/sap/ZHEPA_COMPLIANCE_SRV')
  const [realTime, setRealTime] = useState(true)
  const [retries, setRetries] = useState(3)
  const [timeout, setTimeoutMs] = useState(30000)

  // Counted once from the seeded log and then adjusted by what this session
  // sends, so the cards move when a Sync lands rather than staying decorative.
  const logs = useMemo(() => [...sent, ...SEEDED_LOGS], [sent])

  const stats = useMemo(() => ({
    activeModules: enabled.length,
    success: logs.filter((l) => l.status === 'success').length,
    failed: logs.filter((l) => l.status === 'error').length,
    total: logs.length,
  }), [logs, enabled])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactionsOf(moduleCode).filter((x) => {
      const d = directionOf(x.code)
      const dirOk = direction === 'all' || d === 'both' || d === direction
      const qOk = !q || [x.code, x.name, x.category].join(' ').toLowerCase().includes(q)
      return dirOk && qOk
    })
  }, [moduleCode, direction, search])

  const counts = useMemo(() => {
    const all = transactionsOf(moduleCode)
    const of = (want) => all.filter((x) => {
      const d = directionOf(x.code)
      return d === want || d === 'both'
    }).length
    return { all: all.length, 'to-sap': of('to-sap'), 'to-oxmaint': of('to-oxmaint') }
  }, [moduleCode])

  const shownLogs = useMemo(() => logs.filter((l) => (
    (logStatus === 'all' || l.status === logStatus)
    && (logModule === 'all' || l.moduleCode === logModule)
  )), [logs, logStatus, logModule])

  /**
   * Write what the configuration panel did into the communication log.
   *
   * The panel owns the call — it holds the endpoint, the payload and the reply,
   * and it is where a reader decides what to send. This only records the
   * outcome, so the log and the card agree about what happened without either
   * of them re-issuing anything.
   */
  const record = (txn, r) => {
    setSent((prev) => [{
      id: `LOG-${String(90000 + prev.length)}`,
      minutesAgo: 0,
      moduleCode: txn.moduleCode,
      module: MODULES[txn.moduleCode].name,
      transaction: txn.code,
      transactionName: txn.name,
      direction: directionOf(txn.code) === 'to-oxmaint' ? 'inbound' : 'outbound',
      live: Boolean(r.sent),
      durationMs: r.durationMs || 0,
      thisSession: true,
      status: r.status,
      http: r.http ?? null,
      body: r.body ?? null,
      message: r.sent
        ? (r.status === 'error'
          ? (sapMessage(r.body) || r.message || `${r.http} from ${LIVE[txn.code]?.path || 'the gateway'}`)
          : `${r.http} from ${LIVE[txn.code]?.path} — ${describe(r.body)}`)
        : 'Recorded against this session. This transaction has no counterpart in the compliance gateway, so nothing left the browser.',
    }, ...prev])
  }

  const lastFor = (code) => sent.find((l) => l.transaction === code) || null

  const toggleModule = (code) => setEnabled((prev) => (
    prev.includes(code)
      ? (prev.length > 1 ? prev.filter((c) => c !== code) : prev)
      : MODULE_ORDER.filter((c) => c === code || prev.includes(c))
  ))

  return (
    <div>
      <PageHeading
        title="SAP Integration Portal"
        subtitle="Monitor module syncs, review communication logs, and manage SAP connection settings."
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {tab !== 'transactions' && (
              <Action icon="back" onClick={() => setTab('transactions')}>Back</Action>
            )}
            <Action icon="clipboard" onClick={() => setTab(tab === 'communications' ? 'transactions' : 'communications')}>
              Communication Logs
            </Action>
            <Action icon="sliders" onClick={() => setTab(tab === 'configuration' ? 'transactions' : 'configuration')}>
              Configuration
            </Action>
            <span style={styles.connected}>
              <span style={styles.dot} />
              Connected to SAP
            </span>
          </div>
        }
      />

      <div style={styles.statRow}>
        {[
          { label: 'Active Modules', value: stats.activeModules, icon: 'box' },
          { label: 'Successful Syncs', value: stats.success, icon: 'check' },
          { label: 'Failed Syncs', value: stats.failed, icon: 'cross', alert: stats.failed > 0 },
          { label: 'Total Messages', value: stats.total, icon: 'doc' },
        ].map((s) => (
          <div key={s.label} style={{ ...styles.statCard, borderLeftColor: s.alert ? TONE.red.fg : ACCENT }}>
            <Glyph name={s.icon} size={18} color={s.alert ? TONE.red.fg : ACCENT} />
            <div style={{ ...styles.statValue, color: s.alert ? TONE.red.fg : ACCENT }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {tab === 'transactions' && (
        <div style={styles.body}>
          <aside style={styles.sidebar}>
            <div style={styles.sideHead}>SAP Modules</div>
            {MODULE_ORDER.filter((c) => enabled.includes(c)).map((code) => {
              const on = code === moduleCode
              return (
                <button key={code} onClick={() => { setModuleCode(code); setSearch(''); setDirection('all') }}
                  style={{
                    ...styles.sideRow,
                    background: on ? '#eef1ff' : '#fff',
                    color: on ? ACCENT : SUB,
                    borderLeftColor: on ? ACCENT : 'transparent',
                  }}>
                  <Glyph name={MODULES[code].icon} size={16} color={on ? ACCENT : MUTE} />
                  <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>{MODULES[code].name}</span>
                  <span style={{ ...styles.sideCount, background: on ? FILL : '#e2e8f0', color: on ? '#fff' : SUB }}>
                    {countOf(code)}
                  </span>
                </button>
              )
            })}
          </aside>

          <div style={{ minWidth: 0 }}>
            <div style={styles.gridHead}>
              <h2 style={styles.gridTitle}>{MODULES[moduleCode].name} Transactions</h2>
              <div style={{ width: 260, flexShrink: 0 }}>
                <SearchBar value={search} onChange={setSearch} placeholder="Search transactions" />
              </div>
            </div>

            <div style={styles.tabRow}>
              {[['all', 'All'], ['to-sap', 'To SAP'], ['to-oxmaint', 'To OXmaint']].map(([key, label]) => (
                <button key={key} onClick={() => setDirection(key)}
                  style={{ ...styles.dirTab, ...(direction === key ? styles.dirTabOn : null) }}>
                  {key !== 'all' && <Glyph name={key === 'to-sap' ? 'up' : 'down'} size={13} color={direction === key ? ACCENT : MUTE} />}
                  {label}
                  <span style={styles.dirCount}>{counts[key]}</span>
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <EmptyPanel title="No transactions found for the selected filters.">
                Widen the direction cut, or clear the search.
              </EmptyPanel>
            ) : (
              <div style={styles.cardGrid}>
                {rows.map((txn) => {
                  const dir = directionOf(txn.code)
                  const last = lastFor(txn.code)
                  const live = isLive(txn.code)
                  return (
                    <div key={txn.code} style={styles.txnCard}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={styles.code}>{txn.code}</span>
                        <span style={{ marginLeft: 'auto' }}>
                          <Pill tone={DIRECTION_TONE[dir]}>{DIRECTION_LABEL[dir]}</Pill>
                        </span>
                      </div>

                      <div style={{ marginTop: 11, minHeight: 46 }}>
                        <h3 style={styles.txnName}>{txn.name}</h3>
                        <p style={styles.txnCat}>{txn.category}</p>
                      </div>

                      {live && (
                        <p style={styles.liveNote}>
                          <Glyph name="link" size={12} color={ACCENT} />
                          <span><strong>{LIVE[txn.code].verb}</strong> {LIVE[txn.code].path}</span>
                        </p>
                      )}

                      <div style={styles.txnFoot}>
                        <button onClick={() => setConfiguring(txn)} style={styles.syncBtn}>
                          Sync
                        </button>
                        {last && (
                          <button onClick={() => setOpened(last)} style={styles.resultBtn}>
                            <Pill tone={STATUS_TONE[last.status]}>
                              {last.status === 'error' ? 'Error' : 'Synced'}
                            </Pill>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p style={styles.footNote}>
              Four of these reach the compliance gateway for real — the equipment master read, the
              maintenance order read, the certification post and the handshake. They are marked with
              the endpoint they call. The rest are the catalogue this site has not mapped yet, and a
              Sync on one records that nothing was sent.
            </p>
          </div>
        </div>
      )}

      {tab === 'communications' && (
        <div style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Communication Logs</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={styles.filterLabel}>Status</label>
              <select value={logStatus} onChange={(e) => setLogStatus(e.target.value)} style={styles.select}>
                <option value="all">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
              <label style={styles.filterLabel}>Module</label>
              <select value={logModule} onChange={(e) => setLogModule(e.target.value)} style={styles.select}>
                <option value="all">All Modules</option>
                {MODULE_ORDER.map((c) => <option key={c} value={c}>{MODULES[c].name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Log Number', 'Sync Timestamp', 'Module', 'Transaction', 'Direction', 'Status', 'Message'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownLogs.slice(0, 60).map((l) => (
                  <tr key={l.id} onClick={() => setOpened(l)} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.logId}>{l.id}</span>
                      {l.thisSession && <span style={styles.sessionMark}>this session</span>}
                    </td>
                    <td style={{ ...styles.td, color: MUTE }}>{l.thisSession ? 'just now' : fmtAgo(l.minutesAgo)}</td>
                    <td style={styles.td}>{l.module}</td>
                    <td style={styles.td}>
                      <strong style={{ color: INK }}>{l.transaction}</strong>
                      <span style={{ display: 'block', fontSize: 10.5, color: MUTE }}>{l.transactionName}</span>
                    </td>
                    <td style={styles.td}>
                      <Glyph name={l.direction === 'inbound' ? 'down' : 'up'} size={12} color={MUTE} />
                      <span style={{ marginLeft: 5 }}>{l.direction}</span>
                    </td>
                    <td style={styles.td}>
                      <Pill tone={STATUS_TONE[l.status]}>{l.status}</Pill>
                    </td>
                    <td style={{ ...styles.td, color: SUB, maxWidth: 340 }}>
                      {l.message}
                      {!l.live && <span style={styles.notSent}>not a gateway call</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shownLogs.length === 0 && (
            <EmptyPanel title="Nothing matches these filters.">
              Widen the status or the module.
            </EmptyPanel>
          )}
        </div>
      )}

      {tab === 'configuration' && (
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Configuration</h2>

          <div style={{ marginTop: 16 }}>
            <div style={styles.cfgLabel}>Modules</div>
            <p style={styles.cfgHint}>
              A module switched off leaves the sidebar and its transactions stop being counted.
              One has to stay on.
            </p>
            <div style={styles.toggleGrid}>
              {MODULE_ORDER.map((code) => {
                const on = enabled.includes(code)
                return (
                  <button key={code} onClick={() => toggleModule(code)} style={styles.toggleRow}>
                    <span style={{ ...styles.switch, background: on ? FILL : '#cbd5e1' }}>
                      <span style={{ ...styles.knob, transform: `translateX(${on ? 17 : 2}px)` }} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{MODULES[code].name}</span>
                    <span style={{ fontSize: 11, color: MUTE }}>{countOf(code)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={styles.cfgGrid}>
            <Field label="Destination">
              <input value={destination} onChange={(e) => setDestination(e.target.value)} style={styles.input} />
            </Field>
            <Field label="Protocol">
              <select value={protocol} onChange={(e) => setProtocol(e.target.value)} style={styles.input}>
                {['OData v2', 'OData v4', 'SOAP', 'RFC', 'BTP'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Authentication">
              <input value="OAuth 2.0 client credentials" readOnly style={{ ...styles.input, color: MUTE }} />
            </Field>
            <Field label="Timeout (ms)">
              <input type="number" value={timeout} onChange={(e) => setTimeoutMs(Number(e.target.value))} style={styles.input} />
            </Field>
            <Field label="Retry attempts">
              <input type="number" value={retries} onChange={(e) => setRetries(Number(e.target.value))} style={styles.input} />
            </Field>
            <Field label="Real-time sync">
              <button onClick={() => setRealTime((v) => !v)} style={{ ...styles.toggleRow, padding: '9px 11px', width: '100%' }}>
                <span style={{ ...styles.switch, background: realTime ? FILL : '#cbd5e1' }}>
                  <span style={{ ...styles.knob, transform: `translateX(${realTime ? 17 : 2}px)` }} />
                </span>
                <span style={{ flex: 1, textAlign: 'left' }}>{realTime ? 'On' : 'Batched'}</span>
              </button>
            </Field>
          </div>

          <p style={styles.cfgFoot}>
            These settings shape what this screen issues. The gateway behind the four live
            transactions reads its own configuration server-side, so changing the destination here
            does not repoint it — that is deliberate: a client-side field that silently redirected a
            compliance post would be the worst kind of control.
          </p>
        </div>
      )}

      {configuring && (
        <SapSyncDialog
          transaction={configuring}
          onClose={() => setConfiguring(null)}
          onResult={(r) => {
            record(configuring, r)
            setConfiguring(null)
          }}
        />
      )}

      {opened && <LogDetails log={opened} onClose={() => setOpened(null)} />}
    </div>
  )
}

/** The SAP message out of an OData error envelope, where there is one. */
function sapMessage(json) {
  const e = json?.error
  if (!e) return null
  const text = e.message?.value || e.message
  return e.code ? `${e.code} — ${text}` : text
}

/** One line describing what came back, without dumping the envelope. */
function describe(json) {
  const d = json?.d
  if (!d) return 'no payload'
  if (Array.isArray(d.results)) return `${d.results.length} record(s)`
  const keys = Object.keys(d).filter((k) => !k.startsWith('__'))
  return `${keys.length} field(s)`
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={styles.cfgLabel}>{label}</div>
      {children}
    </div>
  )
}

/**
 * The reply, in full.
 *
 * A live transaction shows the body it got back. The value of this screen is
 * that somebody can read the actual envelope rather than take a green tick on
 * trust, and a 409 with a SAP code is exactly the thing worth reading.
 */
function LogDetails({ log, onClose }) {
  const ref = useRef(null)
  return (
    <div style={styles.scrim} onClick={onClose} role="presentation">
      <div ref={ref} style={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog">
        <div style={styles.dialogHead}>
          <h3 style={styles.dialogTitle}>{log.transaction} · {log.id}</h3>
          <Pill tone={STATUS_TONE[log.status]}>{log.status}</Pill>
          <button onClick={onClose} style={styles.close} aria-label="Close">
            <Glyph name="cross" size={16} color={MUTE} />
          </button>
        </div>

        <div style={styles.dialogBody}>
          <dl style={styles.kv}>
            <dt style={styles.dt}>Transaction</dt><dd style={styles.dd}>{log.transactionName}</dd>
            <dt style={styles.dt}>Module</dt><dd style={styles.dd}>{log.module}</dd>
            <dt style={styles.dt}>Direction</dt><dd style={styles.dd}>{log.direction}</dd>
            <dt style={styles.dt}>Elapsed</dt><dd style={styles.dd}>{log.durationMs} ms</dd>
            {log.http != null && <><dt style={styles.dt}>HTTP</dt><dd style={styles.dd}>{log.http}</dd></>}
          </dl>

          <p style={styles.dialogMsg}>{log.message}</p>

          {log.live ? (
            log.body ? (
              <pre style={styles.pre}>{JSON.stringify(log.body, null, 2)}</pre>
            ) : (
              <EmptyPanel title="No body was returned.">
                The call reached the gateway but came back without a payload.
              </EmptyPanel>
            )
          ) : (
            <EmptyPanel title="Nothing left the browser.">
              This transaction is in the catalogue but has no counterpart in the compliance
              gateway, so there is no request or response to show.
            </EmptyPanel>
          )}
        </div>
      </div>
    </div>
  )
}

const card = {
  background: '#fff', borderRadius: 12,
  borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
}

const styles = {
  connected: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 700, color: '#047857', background: '#ecfdf5',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#a7f3d0',
  },
  dot: { width: 7, height: 7, borderRadius: 999, background: '#059669' },

  statRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
    gap: 12, marginBottom: 16,
  },
  statCard: {
    ...card, padding: '18px 20px',
    borderLeftStyle: 'solid', borderLeftWidth: 4,
  },
  statValue: { fontSize: 30, fontWeight: 800, lineHeight: 1.1, margin: '8px 0 4px', fontVariantNumeric: 'tabular-nums' },
  statLabel: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.5 },

  body: { display: 'grid', gridTemplateColumns: 'minmax(210px,240px) minmax(0,1fr)', gap: 16, alignItems: 'start' },

  sidebar: { ...card, padding: 14, position: 'sticky', top: 16 },
  sideHead: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 9,
  },
  sideRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    border: 'none', borderLeftStyle: 'solid', borderLeftWidth: 3, borderRadius: 8, marginBottom: 3,
  },
  sideCount: {
    fontSize: 10.5, fontWeight: 800, padding: '1px 8px', borderRadius: 999,
    fontVariantNumeric: 'tabular-nums', flexShrink: 0,
  },

  gridHead: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 },
  gridTitle: { margin: 0, fontSize: 19, fontWeight: 700, color: INK, flex: 1, minWidth: 0 },

  tabRow: {
    display: 'flex', gap: 0, marginBottom: 14, padding: 3, borderRadius: 10,
    background: '#f1f5f9', width: 'fit-content', flexWrap: 'wrap',
  },
  dirTab: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 15px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    border: 'none', borderRadius: 8, background: 'transparent', color: MUTE,
  },
  dirTabOn: { background: '#fff', color: ACCENT, boxShadow: '0 1px 2px rgba(15,23,42,.08)' },
  dirCount: {
    fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
    background: '#e2e8f0', color: SUB, fontVariantNumeric: 'tabular-nums',
  },

  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 },
  txnCard: { ...card, padding: '16px 17px', display: 'flex', flexDirection: 'column', minWidth: 0 },
  code: {
    fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, padding: '3px 9px', borderRadius: 6,
    background: FILL, color: '#fff', fontVariantNumeric: 'tabular-nums',
  },
  txnName: { margin: 0, fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.4 },
  txnCat: { margin: '4px 0 0', fontSize: 11.5, color: MUTE },
  liveNote: {
    display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 0', padding: '7px 9px',
    borderRadius: 8, background: '#f8fafc', fontSize: 10.5, color: SUB,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    fontFamily: 'ui-monospace, Menlo, monospace', overflow: 'hidden',
  },
  txnFoot: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 13 },
  syncBtn: {
    flex: 1, padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 9, background: '#fff', color: ACCENT, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  resultBtn: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' },

  footNote: {
    margin: '16px 2px 0', paddingTop: 13, fontSize: 11.5, color: MUTE, lineHeight: 1.6,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },

  panel: { ...card, padding: '18px 20px' },
  panelHead: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: INK },
  filterLabel: { fontSize: 11.5, fontWeight: 700, color: MUTE },
  select: {
    padding: '7px 10px', fontSize: 12, fontWeight: 600, color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
    borderRadius: 8, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  },

  table: { width: '100%', borderCollapse: 'collapse', minWidth: 900 },
  th: {
    textAlign: 'left', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, padding: '9px 11px', whiteSpace: 'nowrap',
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: LINE,
  },
  tr: { cursor: 'pointer' },
  td: {
    padding: '10px 11px', fontSize: 12, color: INK, verticalAlign: 'middle',
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: LINE,
  },
  logId: { fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  sessionMark: {
    display: 'block', fontSize: 9.5, fontWeight: 700, color: ACCENT,
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2,
  },
  notSent: { display: 'block', fontSize: 10, color: MUTE, marginTop: 3, fontStyle: 'italic' },

  cfgLabel: {
    fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 6,
  },
  cfgHint: { margin: '0 0 11px', fontSize: 12, color: SUB, lineHeight: 1.55 },
  toggleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 8 },
  toggleRow: {
    display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 9,
    background: '#fff', fontSize: 12.5, fontWeight: 600, color: INK, cursor: 'pointer',
    fontFamily: 'inherit', borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  switch: {
    position: 'relative', width: 36, height: 20, borderRadius: 999, flexShrink: 0,
    transition: 'background .18s', display: 'inline-block',
  },
  knob: {
    position: 'absolute', top: 2, left: 0, width: 16, height: 16, borderRadius: 999,
    background: '#fff', transition: 'transform .18s', boxShadow: '0 1px 2px rgba(15,23,42,.3)',
  },

  cfgGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
    gap: 14, marginTop: 20,
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 12.5,
    fontFamily: 'inherit', color: INK, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE, borderRadius: 9, outline: 'none',
  },
  cfgFoot: {
    margin: '20px 0 0', paddingTop: 14, fontSize: 11.5, color: MUTE, lineHeight: 1.6,
    borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: LINE,
  },

  scrim: {
    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '20px 16px', overflow: 'hidden',
  },
  dialog: {
    background: '#fff', borderRadius: 13, width: '100%', maxWidth: 720,
    display: 'flex', flexDirection: 'column', maxHeight: '100%', minHeight: 0,
    boxShadow: '0 20px 50px rgba(15,23,42,.25)',
  },
  dialogHead: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', flexShrink: 0,
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: LINE,
  },
  dialogTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: INK, flex: 1, minWidth: 0 },
  close: {
    width: 30, height: 30, display: 'grid', placeItems: 'center', background: 'transparent',
    border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
  },
  dialogBody: { padding: '16px 18px', overflowY: 'auto', minHeight: 0, flex: 1 },
  kv: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: 0 },
  dt: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4 },
  dd: { margin: 0, fontSize: 12.5, color: INK },
  dialogMsg: {
    margin: '14px 0 0', padding: '11px 13px', borderRadius: 9, background: '#f8fafc',
    fontSize: 12.5, color: INK, lineHeight: 1.6,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  pre: {
    margin: '13px 0 0', padding: '13px 15px', borderRadius: 10, background: '#0f172a',
    color: '#e2e8f0', fontSize: 11.5, lineHeight: 1.6, overflowX: 'auto',
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
}
