'use client'

// The Overview block on the product's Maintenance Requests screen.
//
// A QR card on the left, and on the right a summary split in two: Request
// Status Overview across the top and Priority Breakdown under it, eight cards
// in total, each a count with an icon, a description and the cut it applies to
// the list. The whole block collapses, and which cards are shown is remembered
// per reader — both the way the product does it.
//
// The colours are the product's, deliberately. Elsewhere in this portal colour
// is rationed to states that need acting on, but this is a screen being copied
// rather than designed, and a reviewer holding the two side by side is checking
// the yellow on Pending as much as the number in it.

import { useEffect, useRef, useState } from 'react'
import { PALETTE } from '../lib/kit'
import { Glyph, BRAND } from '../lib/productKit'
import { assetPath } from '@/lib/apiPath'

const { INK, SUB, MUTE, LINE } = PALETTE

// The product's own eight, in its order, with its own tints.
export const STATUS_CARDS = [
  { id: 'total', title: 'Total Requests', description: 'All maintenance requests', icon: 'chart', fg: '#2563eb', bg: '#dbeafe' },
  { id: 'pending', title: 'Pending', description: 'Awaiting attention', icon: 'clock', fg: '#ca8a04', bg: '#fef9c3' },
  { id: 'under_review', title: 'Under Review', description: 'Currently being reviewed', icon: 'wrench', fg: '#2563eb', bg: '#dbeafe' },
  { id: 'work_order_created', title: 'Work Order Created', description: 'Work order generated', icon: 'check', fg: '#16a34a', bg: '#dcfce7' },
]

export const PRIORITY_CARDS = [
  { id: 'critical', title: 'Critical', description: 'Urgent attention required', icon: 'warning', fg: '#dc2626', bg: '#fee2e2' },
  { id: 'high', title: 'High', description: 'High priority requests', icon: 'warning', fg: '#ea580c', bg: '#ffedd5' },
  { id: 'medium', title: 'Medium', description: 'Standard priority', icon: 'clock', fg: '#ca8a04', bg: '#fef9c3' },
  { id: 'low', title: 'Low', description: 'Low priority requests', icon: 'check', fg: '#16a34a', bg: '#dcfce7' },
]

const ALL_IDS = [...STATUS_CARDS, ...PRIORITY_CARDS].map((c) => c.id)

/**
 * Which cards this reader keeps, remembered between visits.
 *
 * Read after mount rather than in the initialiser: the product reads
 * localStorage while computing initial state, which on a server-rendered page
 * means the server draws eight cards and the client draws five — a hydration
 * mismatch. Starting from the full set and narrowing a frame later renders the
 * same markup on both sides.
 */
function useVisibleCards() {
  const [shown, setShown] = useState(ALL_IDS)
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('maintenanceRequestVisibleCards')
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed) && parsed.length) {
        const kept = ALL_IDS.filter((id) => parsed.includes(id))
        if (kept.length) setShown(kept)
      }
    } catch {
      // No storage, or unreadable. The full set is the right answer either way.
    }
    loaded.current = true
  }, [])

  const toggle = (id) => setShown((prev) => {
    // One has to stay: a row of no cards leaves the menu above an empty space.
    const next = prev.includes(id)
      ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev)
      : ALL_IDS.filter((x) => x === id || prev.includes(x))
    if (loaded.current) {
      try { window.localStorage.setItem('maintenanceRequestVisibleCards', JSON.stringify(next)) } catch { /* refused */ }
    }
    return next
  })

  return [shown, toggle]
}

export default function RequestSummary({ counts, cut, onCut, qrUrl, onConfigure }) {
  const [shown, toggle] = useVisibleCards()
  const [menu, setMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!menu) return undefined
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setMenu(false) }
    const esc = (e) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard refused */ }
  }

  /**
   * Save the code.
   *
   * Rendered to a data URL rather than lifted out of the DOM — the SVG on
   * screen carries the logo over it, and what somebody wants to print is the
   * code itself at a size a phone can read from a wall.
   */
  const download = async () => {
    try {
      const { default: QRCode } = await import('qrcode')
      const url = await QRCode.toDataURL(qrUrl, {
        width: 900, margin: 1, errorCorrectionLevel: 'H',
        color: { dark: BRAND[900], light: '#ffffff' },
      })
      const a = document.createElement('a')
      a.href = url
      a.download = 'maintenance-request-qr-code.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch { /* encoder unavailable */ }
  }

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Maintenance Request', url: qrUrl })
        return
      }
      await navigator.clipboard.writeText(qrUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* dismissed, or blocked */ }
  }

  const statuses = STATUS_CARDS.filter((c) => shown.includes(c.id))
  const priorities = PRIORITY_CARDS.filter((c) => shown.includes(c.id))

  return (
    <div style={styles.grid}>
      <aside style={styles.qrCard}>
        <div style={styles.qrHead}>
          <Glyph name="grid" size={17} color={BRAND[600]} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <h3 style={styles.qrTitle}>External Request QR Code</h3>
          </span>
          <span style={styles.quickAccess}>Quick access</span>
        </div>
        <p style={styles.qrWhat}>
          Share this QR code to allow external users to submit maintenance requests
        </p>

        <div style={styles.qrBox}>
          <BrandedQr url={qrUrl} />
          <span style={styles.qrBrand}>
            OXMAINT <span style={{ color: '#e5a50a' }}>AI</span>
          </span>
        </div>

        <div style={styles.qrBadges}>
          <span style={{ ...styles.qrBadge, color: '#16a34a', background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <Glyph name="link" size={11} color="#16a34a" />
            Public Access
          </span>
          <span style={{ ...styles.qrBadge, color: '#2563eb', background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <Glyph name="grid" size={11} color="#2563eb" />
            Mobile Friendly
          </span>
        </div>

        <button onClick={copy} style={styles.copy}>
          <Glyph name="doc" size={14} color="#fff" />
          {copied ? 'URL copied to clipboard' : 'Copy Link'}
        </button>

        <div style={styles.qrActions}>
          <button onClick={download} style={styles.qrAction}>
            <Glyph name="download" size={14} color={SUB} />Download
          </button>
          <button onClick={() => window.print()} style={styles.qrAction}>
            <Glyph name="doc" size={14} color={SUB} />Print
          </button>
          <button onClick={share} style={styles.qrAction}>
            <Glyph name="share" size={14} color={SUB} />Share
          </button>
          <button onClick={onConfigure} style={styles.qrAction}>
            <Glyph name="sliders" size={14} color={SUB} />Configurations
          </button>
        </div>

        {/* The product prints this under the actions, and it earns its place:
            the whole point of the code is that somebody prints it and puts it on
            a wall, which is not obvious from a QR on a screen. */}
        <div style={styles.howTo}>
          <div style={styles.howToTitle}>How to use:</div>
          <ul style={styles.howToList}>
            <li>Print and post this QR code in your facility</li>
            <li>Workers can scan with their mobile devices</li>
            <li>They&rsquo;ll be directed to a maintenance request form</li>
            <li>Requests will appear in your dashboard automatically</li>
          </ul>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <div style={styles.sumHead}>
          <Glyph name="chart" size={17} color={BRAND[600]} />
          <h3 style={styles.sumTitle}>Request Summary</h3>
          <span style={styles.sumMeta}>
            {counts.total} total · {counts.pending} pending · {counts.critical} critical
          </span>
          <span ref={wrap} style={{ marginLeft: 'auto', position: 'relative' }}>
            <button onClick={() => setMenu((v) => !v)} style={styles.cardsBtn}>
              <Glyph name="sliders" size={14} color={SUB} />
              Cards ({shown.length})
            </button>
            {menu && (
              <div style={styles.menu}>
                <div style={styles.menuLabel}>Select cards to display</div>
                {[...STATUS_CARDS, ...PRIORITY_CARDS].map((c) => (
                  <button key={c.id} onClick={() => toggle(c.id)} style={styles.menuItem}>
                    <span style={{
                      ...styles.check,
                      background: shown.includes(c.id) ? BRAND[900] : '#fff',
                      borderColor: shown.includes(c.id) ? BRAND[900] : LINE,
                    }}>
                      {shown.includes(c.id) && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff"
                          strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12.5 5 5 9-11" />
                        </svg>
                      )}
                    </span>
                    {c.title}
                  </button>
                ))}
              </div>
            )}
          </span>
        </div>

        {statuses.length > 0 && (
          <>
            <h4 style={styles.section}>Request Status Overview</h4>
            <div style={styles.cardRow}>
              {statuses.map((c) => (
                <Card key={c.id} card={c} value={counts[c.id]} active={cut === c.id} onClick={() => onCut(c.id)} />
              ))}
            </div>
          </>
        )}

        {priorities.length > 0 && (
          <>
            <h4 style={styles.section}>Priority Breakdown</h4>
            <div style={styles.cardRow}>
              {priorities.map((c) => (
                <Card key={c.id} card={c} value={counts[c.id]} active={cut === c.id} onClick={() => onCut(c.id)} />
              ))}
            </div>
          </>
        )}

        <h4 style={styles.section}>Key Metrics</h4>
        <div style={styles.metricRow}>
          <Metric icon="up" fg="#16a34a" bg="#dcfce7" value={pct(counts.work_order_created, counts.total)}
            title="Completion Rate"
            what={`${counts.work_order_created} of ${counts.total} requests completed`} />
          <Metric icon="clock" fg="#ca8a04" bg="#fef9c3" value={pct(counts.pending, counts.total)}
            title="Pending Rate"
            what={`${counts.pending} requests awaiting attention`} />
          <Metric icon="cross" fg="#dc2626" bg="#fee2e2" value={pct(counts.rejected, counts.total)}
            title="Rejection Rate"
            what={`${counts.rejected} requests rejected`} />
        </div>

        {/* The same figures read the other way round. The cards above answer
            "how many"; this answers "where are they", which is the question
            somebody opening the screen in the morning actually has. */}
        <div style={styles.insights}>
          <div style={styles.insightsHead}>
            <Glyph name="chart" size={17} color={BRAND[600]} />
            <h4 style={styles.insightsTitle}>Quick Insights</h4>
          </div>
          <div style={styles.insightGrid}>
            <Insight label="Most urgent requests:"
              value={`${counts.critical} (${pct(counts.critical, counts.total)})`} />
            <Insight label="Work in progress:" value={`${counts.under_review} requests`} />
            <Insight label="Closed:" value={`${counts.work_order_created} requests`} />
            <Insight label="Backlog (Pending):" value={`${counts.pending} requests`} />
            <Insight label="Assignments:" value={`${counts.assigned ?? 0} assigned`} />
            <Insight label="Cancelled:" value={`${counts.rejected} requests`} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ card, value, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        ...styles.card,
        borderColor: active ? BRAND[600] : LINE,
        boxShadow: active ? `0 0 0 1px ${BRAND[600]}` : '0 1px 2px rgba(15,23,42,.04)',
      }}>
      <span style={{ ...styles.cardIcon, background: card.bg }}>
        <Glyph name={card.icon} size={18} color={card.fg} />
      </span>
      <span style={styles.cardValue}>{value ?? 0}</span>
      <span style={styles.cardTitle}>{card.title}</span>
      <span style={styles.cardWhat}>{card.description}</span>
    </button>
  )
}

/**
 * The code itself, encoded.
 *
 * A real QR, from the same `qrcode` package the product uses and with the same
 * options it passes — error correction H, one module of quiet zone, drawn in
 * the brand navy. H matters here: it tolerates about thirty per cent of the
 * code being obscured, which is what lets the logo sit in the middle without
 * breaking the scan.
 *
 * An earlier version drew a pattern that looked like a QR and encoded nothing.
 * It read fine in a screenshot and would have failed the first time somebody
 * pointed a phone at it, which is the only thing this card is for.
 */
function BrandedQr({ url }) {
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState('')

  useEffect(() => {
    if (!url) return undefined
    let live = true
    // The browser build, explicitly.
    //
    // `qrcode`'s package entry reaches for Node's fs to support writing a file,
    // which does not resolve in the browser — the import rejected, the catch
    // swallowed it, and the card showed an empty square that looked like a
    // slow load. `lib/browser` is the same encoder without the file half.
    //
    // Imported here rather than at module scope so it is fetched with this
    // screen instead of with the portal's first paint.
    import('qrcode/lib/browser')
      .then((mod) => {
        const QRCode = mod.default || mod
        return QRCode.toString(url, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'H',
          color: { dark: BRAND[900], light: '#ffffff' },
        })
      })
      .then((out) => { if (live) setSvg(out) })
      .catch((e) => {
        // Say so rather than leaving a blank square. The Copy Link button below
        // still carries the address, which is the part anybody would use.
        if (live) setFailed(e?.message || 'could not be generated')
      })
    return () => { live = false }
  }, [url])

  return (
    <span style={styles.qrFrame}>
      {svg
        ? <span style={styles.qrSvg} dangerouslySetInnerHTML={{ __html: svg }} />
        : <span style={styles.qrPending}>{failed ? 'QR code unavailable' : ''}</span>}
      {/* The logo sits over the middle. Error correction H is what makes that
          safe; at any lower level this would stop the code scanning. */}
      {svg && (
        <span style={styles.qrLogo}>
          <img src={assetPath('/oxmaint/logo.png')} alt="" width="34" height="34"
            style={{ display: 'block', objectFit: 'contain' }} />
        </span>
      )}
    </span>
  )
}

/** A whole percentage, and nought rather than NaN when there is nothing yet. */
const pct = (n, of) => `${of ? Math.round((n / of) * 100) : 0}%`

function Metric({ icon, fg, bg, value, title, what }) {
  return (
    <div style={styles.metric}>
      <span style={{ ...styles.metricIcon, background: bg }}>
        <Glyph name={icon} size={16} color={fg} />
      </span>
      <span style={styles.metricValue}>{value}</span>
      <span style={styles.metricTitle}>{title}</span>
      <span style={styles.metricWhat}>{what}</span>
    </div>
  )
}

function Insight({ label, value }) {
  return (
    <span style={styles.insightRow}>
      <span style={styles.insightLabel}>{label}</span>
      <span style={styles.insightValue}>{value}</span>
    </span>
  )
}

const styles = {
  qrActions: { display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 },
  qrAction: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
    padding: '8px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
    borderRadius: 9, background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  howTo: {
    marginTop: 13, padding: '13px 14px', borderRadius: 10,
    background: '#eff6ff', borderStyle: 'solid', borderWidth: 1, borderColor: '#dbeafe',
  },
  howToTitle: { fontSize: 12.5, fontWeight: 700, color: '#1e3a8a', marginBottom: 8 },
  howToList: { margin: 0, paddingLeft: 15, fontSize: 11.5, color: '#1e40af', lineHeight: 1.75 },

  metricRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 },
  metric: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    padding: '16px 17px', borderRadius: 12, background: '#fff', minWidth: 0,
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  metricIcon: { width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', marginBottom: 12 },
  metricValue: { fontSize: 25, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  metricTitle: { fontSize: 12.5, fontWeight: 600, color: SUB, marginTop: 7 },
  metricWhat: { fontSize: 11, color: MUTE, marginTop: 3, lineHeight: 1.45 },

  insights: {
    marginTop: 18, padding: '16px 18px', borderRadius: 12,
    background: '#eff6ff', borderStyle: 'solid', borderWidth: 1, borderColor: '#dbeafe',
  },
  insightsHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 },
  insightsTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: BRAND[900] },
  insightGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
    columnGap: 26, rowGap: 9,
  },
  insightRow: { display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 },
  insightLabel: { flex: 1, minWidth: 0, fontSize: 12, color: '#1e40af' },
  insightValue: { fontSize: 12, fontWeight: 700, color: BRAND[900], whiteSpace: 'nowrap' },

  qrFrame: { position: 'relative', display: 'grid', placeItems: 'center' },
  qrSvg: { display: 'block', width: 150, height: 150 },
  qrPending: {
    display: 'grid', placeItems: 'center', width: 150, height: 150, borderRadius: 6,
    background: '#f1f5f9', fontSize: 11, color: MUTE, textAlign: 'center', padding: 10,
  },
  qrLogo: {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    width: 40, height: 40, borderRadius: 8, background: '#fff',
    display: 'grid', placeItems: 'center', padding: 3,
  },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(230px,290px) minmax(0,1fr)', gap: 16, alignItems: 'start' },

  qrCard: {
    background: '#fff', borderRadius: 12, padding: '16px 17px',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  qrHead: { display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 8 },
  qrTitle: { margin: 0, fontSize: 13.5, fontWeight: 700, color: INK, lineHeight: 1.35 },
  quickAccess: {
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, flexShrink: 0,
    color: BRAND[600], background: BRAND[50],
    borderStyle: 'solid', borderWidth: 1, borderColor: BRAND[100],
  },
  qrWhat: { margin: '0 0 13px', fontSize: 11.5, color: MUTE, lineHeight: 1.55 },
  qrBox: {
    display: 'grid', placeItems: 'center', gap: 7, padding: '14px 12px 11px', borderRadius: 10,
    background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: LINE, marginBottom: 12,
  },
  qrBrand: { fontSize: 10, fontWeight: 800, letterSpacing: 1, color: BRAND[900] },
  qrBadges: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 13 },
  qrBadge: {
    fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
    borderStyle: 'solid', borderWidth: 1,
  },
  copy: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
    padding: '10px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    border: 'none', borderRadius: 9, background: BRAND[900], color: '#fff', cursor: 'pointer',
  },

  sumHead: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4,
    padding: '13px 15px', borderRadius: 11, background: '#fff',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  sumTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: INK },
  sumMeta: { fontSize: 11.5, color: MUTE },
  cardsBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px',
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderRadius: 9,
    background: '#fff', color: SUB, cursor: 'pointer',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  menu: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 240,
    background: '#fff', borderRadius: 10, padding: 7,
    boxShadow: '0 12px 30px rgba(15,23,42,.16)',
    borderStyle: 'solid', borderWidth: 1, borderColor: LINE,
  },
  menuLabel: {
    fontSize: 13, fontWeight: 500, color: INK, padding: '2px 4px 8px', marginBottom: 6,
    borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: LINE,
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px',
    fontSize: 12.5, color: INK, background: 'transparent', border: 'none',
    borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  },
  check: {
    width: 16, height: 16, borderRadius: 4, display: 'grid', placeItems: 'center', flexShrink: 0,
    borderStyle: 'solid', borderWidth: 1.5,
  },

  section: { margin: '18px 0 10px', fontSize: 14.5, fontWeight: 700, color: INK },
  cardRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0,
    padding: '16px 17px', borderRadius: 12, background: '#fff', minWidth: 0,
    borderStyle: 'solid', borderWidth: 1, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  },
  cardIcon: {
    width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', marginBottom: 12,
  },
  cardValue: { fontSize: 27, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  cardTitle: { fontSize: 12.5, fontWeight: 600, color: SUB, marginTop: 7 },
  cardWhat: { fontSize: 11, color: MUTE, marginTop: 3, lineHeight: 1.45 },
}
