'use client'

// The Maintenance Correlation Log — now with the AI Auditor reading it, and a
// way to add to it.
//
// The log is the evidence behind the business case: each alert against what an
// engineer physically found, and how far ahead of the scheduled PM it was
// caught. It used to be a static table. Two things were missing and are added
// here: the intelligence that turns the rows into a number a manager acts on —
// detection precision, the false positive to tune, the best catch — and a way to
// log a new correlation as engineers close them out, persisted like every other
// record raised in this portal.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, Toolbar, StatusBadge, PALETTE } from '../lib/kit'
import PageHeading from '../components/PageHeading'
import { StatCards } from '../components/MetricCard'
import Modal from '../components/Modal'
import { useSite } from '../lib/siteStore'
import { useCorrelationStore } from '../lib/store'
import { CORRELATION_ROWS, fmtDate } from '../lib/data'

const { SUB, MUTE, INK, LINE, GREEN, AMBER, RED, ACCENT } = PALETTE

const confirmedTone = (c) => (c === 'Yes' ? 'green' : c === 'No' ? 'red' : 'amber')

// A rough "days ahead" from the free-text lead time, so the auditor can name the
// best catch without the workbook carrying a number it never had.
function leadDays(text) {
  const m = String(text || '').match(/(\d+(?:\.\d+)?)\s*(day|week|month|year)/i)
  if (!m) return null
  const n = parseFloat(m[1])
  const unit = m[2].toLowerCase()
  return n * (unit === 'day' ? 1 : unit === 'week' ? 7 : unit === 'month' ? 30 : 365)
}

// The AI Auditor's read of the whole log: how often a detection held up on
// inspection, what to tune, and the catch that best makes the case.
function analyze(rows) {
  const yes = rows.filter((c) => c.confirmed === 'Yes')
  const no = rows.filter((c) => c.confirmed === 'No')
  const pending = rows.filter((c) => c.confirmed === 'Pending')
  const resolved = yes.length + no.length
  const precision = resolved ? Math.round((yes.length / resolved) * 100) : null

  const standout = yes
    .map((c) => ({ c, d: leadDays(c.leadTime) }))
    .filter((x) => x.d != null)
    .sort((a, b) => b.d - a.d)[0]?.c || null

  const recs = []
  if (no.length) {
    const fp = no[0]
    recs.push(`Tune ${fp._asset} — its ${String(fp.failureMode || 'flagged anomaly').replace(/^N\/A\s*-\s*/i, '')} did not confirm on inspection. Review that threshold to cut the false-positive rate.`)
  }
  if (pending.length) {
    recs.push(`${pending.length} correlation${pending.length > 1 ? 's' : ''} awaiting engineering sign-off — close them to keep the accuracy figure current.`)
  }
  if (standout) {
    recs.push(`Best catch: ${standout.leadTime} on ${standout._asset}. Lead this in the business case.`)
  }
  if (!recs.length) recs.push('Every correlation is confirmed and closed — the detection layer is holding up on inspection.')

  return { yes, no, pending, resolved, precision, standout, recs }
}

export default function Correlation() {
  const router = useRouter()
  const { scope, siteName } = useSite()
  const store = useCorrelationStore()

  const [query, setQuery] = useState('')
  const [conf, setConf] = useState('all')
  const [modal, setModal] = useState(false)
  const [detail, setDetail] = useState(null)

  // Logged-here correlations sit above the seeded log, badged, and feed the same
  // stats and the AI read as the rest.
  const created = useMemo(() => store.created.map((r) => ({
    ...r,
    _asset: r.asset || r._asset || r.assetId || '—',
    _created: true,
  })), [store.created])

  const rows = useMemo(() => scope([...created, ...CORRELATION_ROWS]), [scope, created])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((c) => (
      (conf === 'all' || c.confirmed === conf)
      && (!q || [c.correlationId, c.alertId, c._asset, c.finding, c.failureMode].join(' ').toLowerCase().includes(q))
    ))
  }, [rows, query, conf])

  const ai = useMemo(() => analyze(rows), [rows])

  const stats = [
    { label: 'Correlations', value: rows.length },
    { label: 'Anomaly confirmed', value: ai.yes.length, tone: 'green' },
    { label: 'False positive', value: ai.no.length, tone: ai.no.length ? 'red' : 'green' },
    { label: 'Pending', value: ai.pending.length, tone: ai.pending.length ? 'amber' : 'green' },
    { label: 'Detection precision', value: ai.precision == null ? '—' : ai.precision, unit: ai.precision == null ? '' : '%', tone: ai.precision != null && ai.precision >= 80 ? 'green' : 'amber' },
  ]

  const nextId = () => {
    const nums = store.created.map((r) => Number(String(r.correlationId || '').replace(/\D/g, ''))).filter((n) => n >= 1001)
    return `COR-${(nums.length ? Math.max(...nums) : 1000) + 1}`
  }

  const onCreate = async (v) => {
    await store.create({
      correlationId: nextId(),
      alertId: (v.alertId || '').trim() || '—',
      asset: (v.asset || '').trim(),
      inspectionDate: (v.inspectionDate || '').trim() || '—',
      failureMode: (v.failureMode || '').trim(),
      confirmed: v.confirmed || 'Pending',
      leadTime: (v.leadTime || '').trim() || 'TBD',
      finding: (v.finding || '').trim(),
    })
  }

  const openRow = (c) => {
    if (c._created) setDetail(c)
    else router.push(`/portal/datacenter/correlation/${encodeURIComponent(c.correlationId)}`)
  }

  const columns = [
    { key: 'correlationId', label: 'ID', render: (c) => <span style={styles.mono}>{c.correlationId}</span> },
    { key: 'alertId', label: 'Alert', render: (c) => <span style={styles.mono}>{c.alertId || '—'}</span> },
    { key: '_asset', label: 'Asset', render: (c) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{c._asset}</span>
        {c._created && <span style={styles.newBadge}>New</span>}
      </span>
    ) },
    { key: 'inspectionDate', label: 'Inspected', render: (c) => fmtDate(c.inspectionDate) },
    { key: 'failureMode', label: 'Failure mode confirmed', render: (c) => <span style={{ display: 'block', maxWidth: 210 }}>{c.failureMode || '—'}</span> },
    { key: 'confirmed', label: 'Confirmed', render: (c) => <StatusBadge tone={confirmedTone(c.confirmed)}>{c.confirmed}</StatusBadge> },
    { key: 'leadTime', label: 'Lead time vs PM', render: (c) => <span style={{ display: 'block', maxWidth: 260 }}>{c.leadTime}</span> },
  ]

  return (
    <div>
      <PageHeading
        title="Maintenance Correlation Log"
        subtitle="Each alert against what an engineer physically found, and how far ahead of the scheduled PM it was caught. This is the evidence behind the business case."
        right={
          <button onClick={() => setModal(true)} style={styles.logBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Log correlation
          </button>
        }
      />

      <StatCards items={stats} />

      <AiInsight ai={ai} total={rows.length} />

      <Toolbar
        search={query} onSearch={setQuery} placeholder="Search correlations, assets, findings…"
        filters={[{ label: 'Confirmed', value: conf, options: ['Yes', 'No', 'Pending'], onChange: setConf }]}
        right={siteName !== 'All Sites' ? <StatusBadge tone="blue">{siteName}</StatusBadge> : null}
      />

      <DataTable
        columns={columns}
        rows={shown}
        pageSize={12}
        onRowClick={openRow}
        empty="No correlations match these filters."
      />

      <Modal
        open={modal}
        title="Log a maintenance correlation"
        submitLabel="Log correlation"
        onSubmit={onCreate}
        onClose={() => setModal(false)}
        fields={[
          { key: 'asset', label: 'Asset', required: true, placeholder: 'e.g. CRAC Unit 01 — IAD35' },
          { key: 'alertId', label: 'Linked alert (optional)', placeholder: 'e.g. ALT-0009' },
          { key: 'inspectionDate', label: 'Inspection date', required: true, placeholder: 'YYYY-MM-DD' },
          { key: 'failureMode', label: 'Failure mode confirmed', required: true, placeholder: 'e.g. V03 — Bearing wear' },
          { key: 'confirmed', label: 'Anomaly confirmed?', required: true, options: ['Yes', 'No', 'Pending'] },
          { key: 'leadTime', label: 'Lead time vs PM', placeholder: 'e.g. 12 days ahead of quarterly PM' },
          { key: 'finding', label: 'Engineering finding', placeholder: 'What the inspection found' },
        ]}
      />

      {detail && <DetailOverlay c={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

// The AI Auditor panel over the log — branded in the product's indigo so it
// reads as the intelligent surface, not another stat card.
function AiInsight({ ai, total }) {
  return (
    <div style={styles.aiCard}>
      <div style={styles.aiHead}>
        <span style={styles.aiBadge}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10z" />
          </svg>
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.aiTitle}>AI Auditor · Correlation intelligence</div>
          <div style={styles.aiSub}>What the log says about the detection layer, read across all {total} correlations.</div>
        </div>
        {ai.precision != null && (
          <span style={styles.aiPrecision}>{ai.precision}% precision</span>
        )}
      </div>

      <div style={styles.aiBody}>
        <p style={styles.aiHeadline}>
          {ai.precision == null
            ? 'No correlation has been closed yet — precision will appear once an engineer confirms or clears one.'
            : <>Of <strong style={{ color: INK }}>{ai.resolved}</strong> closed correlations, the detection was right on <strong style={{ color: INK }}>{ai.yes.length}</strong> — a <strong style={{ color: ai.precision >= 80 ? '#047857' : '#b45309' }}>{ai.precision}% detection precision</strong>{ai.no.length ? `, against ${ai.no.length} false positive${ai.no.length > 1 ? 's' : ''}` : ''}{ai.pending.length ? `, with ${ai.pending.length} still under review` : ''}.</>}
        </p>

        <ul style={styles.aiRecs}>
          {ai.recs.map((r, i) => (
            <li key={i} style={styles.aiRec}>
              <span style={styles.aiDot} />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// A read-only detail for a correlation logged in the portal — the seeded rows
// have their own record page; these open here rather than on a page the static
// register cannot resolve.
function DetailOverlay({ c, onClose }) {
  const facts = [
    ['Correlation', c.correlationId], ['Linked alert', c.alertId], ['Asset', c._asset],
    ['Inspection date', c.inspectionDate], ['Failure mode confirmed', c.failureMode],
    ['Confirmed anomaly', c.confirmed], ['Lead time vs PM', c.leadTime], ['Engineering finding', c.finding],
  ].filter(([, v]) => v != null && v !== '')
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.detailCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.detailHead}>
          <div>
            <div style={styles.detailId}>{c.correlationId} <span style={styles.newBadge}>New</span></div>
            <div style={styles.detailAsset}>{c._asset}</div>
          </div>
          <button onClick={onClose} style={styles.x} aria-label="Close">✕</button>
        </div>
        <div style={{ display: 'grid', gap: 11 }}>
          {facts.map(([label, value]) => (
            <div key={label} style={styles.factRow}>
              <span style={styles.factLabel}>{label}</span>
              <span style={styles.factValue}>{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  mono: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11.5, color: SUB },
  newBadge: {
    fontSize: 9.5, fontWeight: 800, color: ACCENT, background: '#e8ecff', border: '1px solid #d6ddff',
    borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap',
  },
  logBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', color: '#fff', cursor: 'pointer',
    background: '#15227a', border: '1px solid #15227a', borderRadius: 9,
  },

  aiCard: {
    border: '1px solid #d6ddff', borderRadius: 14, margin: '4px 0 16px', overflow: 'hidden',
    background: 'linear-gradient(180deg,#f5f7ff 0%,#ffffff 60%)', boxShadow: '0 1px 2px rgba(21,34,122,0.05)',
  },
  aiHead: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid #eaeefb' },
  aiBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#15227a,#3b3fd8)',
    boxShadow: '0 4px 10px rgba(21,34,122,0.28)',
  },
  aiTitle: { fontSize: 14.5, fontWeight: 800, color: ACCENT, letterSpacing: '-0.01em' },
  aiSub: { fontSize: 11.5, color: SUB, marginTop: 1 },
  aiPrecision: {
    flexShrink: 0, fontSize: 11, fontWeight: 800, color: ACCENT, background: '#e8ecff',
    border: '1px solid #d6ddff', borderRadius: 999, padding: '4px 10px',
  },
  aiBody: { padding: '13px 16px' },
  aiHeadline: { margin: 0, fontSize: 13.5, color: SUB, lineHeight: 1.6 },
  aiRecs: { listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  aiRec: { display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, color: INK, lineHeight: 1.5 },
  aiDot: { width: 6, height: 6, borderRadius: '50%', background: '#15227a', marginTop: 6, flexShrink: 0 },

  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 20px' },
  detailCard: { width: '100%', maxWidth: 500, background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.3)', padding: 22 },
  detailHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  detailId: { fontSize: 12, fontWeight: 700, color: ACCENT, fontFamily: 'ui-monospace, Menlo, monospace', display: 'flex', alignItems: 'center', gap: 8 },
  detailAsset: { fontSize: 17, fontWeight: 800, color: INK, marginTop: 4 },
  x: { border: 'none', background: 'none', fontSize: 15, color: MUTE, cursor: 'pointer', fontFamily: 'inherit' },
  factRow: { display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, alignItems: 'start' },
  factLabel: { fontSize: 10.5, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 1 },
  factValue: { fontSize: 12.5, color: INK, lineHeight: 1.55, wordBreak: 'break-word' },
}
