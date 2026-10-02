'use client'

import { useState, useEffect, useRef } from 'react'
import { IBM_Plex_Sans } from 'next/font/google'
import { apiUrl } from '@/lib/apiPath'
import { assetPath } from '@/lib/apiPath'

// The console's landing screen: what this deployment can open.
//
// On the platform this was a grid of twenty-five portals with a search box over
// it. Here there is one, so the search box is gone — a field that filters a
// single card, next to a "1 / 1" counter, is a control that advertises it has
// nothing to do. It comes back when PORTALS has enough entries to need it; the
// filtering it did was four lines over this array.
//
// The grid is sized in fixed-width tracks rather than fractions for the same
// reason. `1fr` columns split whatever width is there between however many
// cards exist, so one card became one card as wide as the window. A card should
// look the same whether it has neighbours or not.

// Where the way back leads. An env var so a staging console can point at its
// own, with the real one as the default so nothing has to be configured for
// the ordinary case. NEXT_PUBLIC_ because the control rendering it is a client
// component, and this is a public address, not a secret.
const IFACTORY_CONSOLE = process.env.NEXT_PUBLIC_IFACTORY_CONSOLE || 'https://admin.ifactoryai.com/admin/portals'

const plex = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

const ACCENT = '#15227a'

// Add a portal here and it appears on the grid. The shape is the platform's, so
// an entry can be copied straight across from its PORTAL_LIST.
const PORTALS = [
  {
    slug: 'oxmaint',
    code: 'oxmaint-cmms',
    name: 'Oxmaint CMMS',
    tagline: 'Assets · work orders · PM · inventory · inspections — demo data',
    route: '/portal/oxmaint/dashboard',
    accent: '#15227a',
  },
  {
    // Second, behind the Oxmaint demo it belongs to, rather than leading the
    // grid: the console's job is to show what this deployment can open, and
    // putting one entry first makes an ordering claim the rest of the list is
    // not making.
    //
    // `route` is an API route, not a page: /api/cmms/enter checks the admin
    // cookie, mints a 60-second single-use ticket and redirects to the CMMS
    // already signed in. Linking straight at cmms.ifactoryai.com would land on
    // a password form, which is the thing this exists to avoid.
    slug: 'cmms',
    code: 'cmms.ifactoryai.com',
    name: 'Oxmaint Vanilla',
    tagline: 'Work orders · assets · PM schedules · requests · inventory — real records, signed in automatically',
    route: '/api/cmms/enter',
    accent: '#0f766e',
    live: true,
  },
  {
    // A customer organisation on the same CMMS, not a separate deployment: its
    // own records, its own users, switched modules. The card signs the console
    // admin in as canary.systems' own admin; the CMMS log names who entered.
    slug: 'canary',
    code: 'canary.systems',
    name: 'Canary Systems',
    tagline: 'Hospital facilities & fire life safety pilot — its own organisation, signed in automatically',
    route: '/api/cmms/enter?org=canary',
    accent: '#7c3aed',
    live: true,
  },
  {
    slug: 'datacenter',
    code: 'datacenter-fsm',
    name: 'Data Center FSM',
    tagline: 'Condition monitoring · vibration, thermal, ultrasound · BMS/EPMS/DCIM',
    route: '/portal/datacenter/overview',
    accent: '#0891b2',
  },
  {
    slug: 'hospitality',
    code: 'oxmaint-hospitality',
    name: 'Hospitality',
    tagline: 'Extended-stay hotel engineering · daily schedule · suite rotation',
    route: '/portal/hospitality/overview',
    accent: '#b45309',
  },
  {
    slug: 'hepa',
    code: 'hepa-compliance',
    // "Pharmaceutical" is the industry, the way Energy and Hospitality are on
    // the cards beside this one — not the customer, whose name stays out of the
    // console and out of the portal chrome.
    name: 'Pharmaceutical — HEPA Compliance',
    tagline: 'Cleanroom integrity testing · leak detection · certification lifecycle · SAP',
    route: '/portal/hepa/overview',
    accent: '#7c3aed',
  },
  {
    slug: 'waga',
    code: 'waga-compliance',
    name: 'Energy — Compliance & EHS',
    tagline: 'Permits · obligations · limits · deviations · safety workflows',
    route: '/portal/waga/overview',
    accent: '#0f766e',
  },
  {
    slug: 'dna',
    code: 'dna-textiles',
    name: 'Textiles — CMMS',
    tagline: 'Work orders · PM · assets · parts · downtime · AI estimates',
    route: '/portal/dna/overview',
    accent: '#7c3aed',
  },
]

// Keyed by slug, the way the platform did it — with two portals the lookup
// earns itself back, and a card with the wrong glyph is worse than no glyph.
const GLYPHS = {
  // Oxmaint: the wrench its own sidebar uses for Maintenance.
  oxmaint: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  // Data center: stacked racks, which is what the estate actually is.
  datacenter: <><rect x="3" y="3" width="18" height="7" rx="1.5" /><rect x="3" y="14" width="18" height="7" rx="1.5" /><path d="M7 6.5h.01M7 17.5h.01M11 6.5h5M11 17.5h5" /></>,
  // HEPA: a filter cartridge — pleated media in a frame, which is the thing
  // every record in that portal is about.
  hepa: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M7.5 4v16M12 4v16M16.5 4v16" /></>,
  // Live CMMS: an activity trace — the one card with something running behind
  // it, rather than a second wrench that would read as a duplicate of the demo.
  cmms: <><path d="M3 12h4l3 8 4-16 3 8h4" /></>,
  // Hospitality: a bed, because this estate is counted in suites.
  hospitality: <><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M2 16h20" /><path d="M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>,
}

function PortalIcon({ slug, size = 24, strokeWidth = 1.85 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {GLYPHS[slug] || GLYPHS.oxmaint}
    </svg>
  )
}

export default function AdminPortalsPage() {
  const [loggingOut, setLoggingOut] = useState(false)
  const [time, setTime] = useState('')
  const cursorRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
    tick(); const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  // Spotlight effect — a soft radial gradient that follows the cursor across
  // the grid area. Adds dynamism without overwhelming the cards.
  useEffect(() => {
    const el = wrapperRef.current; if (!el) return
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${x - 250}px, ${y - 250}px)`
      }
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  const logout = async () => {
    setLoggingOut(true)
    await fetch(apiUrl('/api/admin/logout'), { method: 'POST' })
    window.location.href = '/admin'
  }

  return (
    <div className={plex.className} style={styles.shell}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100%{opacity:1;}50%{opacity:0.5;} }
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(40px,-30px) scale(1.05);} }
        @keyframes floatB { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(-50px,40px) scale(0.95);} }
        @keyframes floatC { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(30px,30px) scale(1.08);} }
        .glass-card { transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s ease, border-color .25s ease; }
        .glass-card:hover { transform: translateY(-4px); }
        .logout-btn:hover { background: linear-gradient(135deg, #b91c1c, #dc2626) !important; box-shadow: 0 6px 20px rgba(220,38,38,0.30) !important; }
        .back-btn:hover { background: rgba(255,255,255,0.9) !important; border-color: rgba(15,23,42,0.18) !important; box-shadow: 0 4px 14px rgba(15,23,42,0.08) !important; }
      `}</style>

      {/* Ambient background orbs (the glass effect rests on this) */}
      <div style={styles.ambient}>
        <div style={{ ...styles.orb, ...styles.orbA }} />
        <div style={{ ...styles.orb, ...styles.orbB }} />
        <div style={{ ...styles.orb, ...styles.orbC }} />
        <div style={styles.noise} />
      </div>

      {/* Top bar */}
      <header style={styles.topBar}>
        <div style={styles.topLeft}>
          {/* The bull alone. A drop-shadow follows its own outline, where a
              box-shadow would draw the rectangle the plate was removed to
              avoid. */}
          <img src={assetPath('/oxmaint/logo-wb.png')} alt="Oxmaint AI" style={styles.mark} />
          <div style={styles.rule} aria-hidden="true" />
          <div>
            <div style={styles.brandName}>
              Oxmaint<span style={styles.brandThin}> AI</span>
            </div>
            <div style={styles.brandSub}>
              <span style={styles.adminPill}>
                <span style={styles.pillDot} />
                ADMIN
              </span>
              <span style={styles.metaText}>portal access</span>
              <span style={styles.metaDot} aria-hidden="true" />
              {/* Tabular figures — otherwise the row twitches every time the
                  clock ticks over to a narrower digit. */}
              <span style={styles.clock}>{time || ' '}</span>
            </div>
          </div>
        </div>
        <div style={styles.topRight}>
          {/* Shown to everyone, not only to whoever arrived through the ticket.
              It used to depend on a cookie the entry route left behind, which
              meant signing out and back in with a password lost the way back —
              in the same browser, for the same person, who had plainly come
              from there. The link is harmless to anyone it was not meant for:
              the iFactory console has its own sign-in and answers for itself. */}
          <a href={IFACTORY_CONSOLE} className="back-btn" style={styles.backBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            iFactory Console
          </a>
          <button onClick={logout} disabled={loggingOut} className="logout-btn" style={styles.logoutBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {loggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* Grid area with cursor spotlight + frosted glass cards */}
      <div ref={wrapperRef} style={styles.gridWrap}>
        <div ref={cursorRef} style={styles.spotlight} aria-hidden="true" />

        <div style={styles.sectionHead}>
          <h2 style={styles.sectionTitle}>Portals</h2>
          <span style={styles.sectionCount}>{PORTALS.length}</span>
        </div>

        <div style={styles.grid}>
          {PORTALS.map((p, i) => (
            <a
              key={p.slug}
              href={p.route}
              {...(p.external || p.live ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="glass-card"
              style={{
                ...styles.card,
                animationDelay: `${i * 0.05}s`,
                borderColor: 'rgba(255,255,255,0.65)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 24px 60px ${p.accent}33, inset 0 1px 0 rgba(255,255,255,0.9)`
                e.currentTarget.style.borderColor = `${p.accent}55`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = styles.card.boxShadow
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.65)'
              }}
            >
              {/* Accent strip + soft accent wash inside the glass */}
              <div style={{ ...styles.cardAccent, background: `linear-gradient(90deg, ${p.accent}, ${p.accent}99)` }} />
              <div style={{ ...styles.cardWash, background: `radial-gradient(circle at 80% 0%, ${p.accent}1a 0%, transparent 55%)` }} />

              {/* Header — icon + open arrow */}
              <div style={styles.cardHeader}>
                <div style={{ ...styles.cardIcon, background: `linear-gradient(135deg, ${p.accent}25, ${p.accent}10)`, color: p.accent, boxShadow: `inset 0 0 0 1px ${p.accent}28` }}>
                  <PortalIcon slug={p.slug} size={24} strokeWidth={1.85} />
                </div>
                <div style={{ ...styles.cardArrow, background: `${p.accent}12`, color: p.accent }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                  </svg>
                </div>
              </div>

              <h3 style={styles.cardTitle}>{p.name}</h3>
              <p style={styles.cardTag}>{p.tagline}</p>

              <div style={styles.cardFooter}>
                <span style={styles.cardRoute}>
                  <span style={{ ...styles.dot, background: p.accent }} />
                  {p.live ? `${p.code} · real records` : p.external ? `${p.code || p.slug} · external` : (p.code || p.slug)}
                </span>
                <span style={{ ...styles.cardCta, color: p.accent }}>{p.external || p.live ? 'Open ↗' : 'Open'}</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      <footer style={styles.footer}>
        <span>Oxmaint AI Admin Console · v1.0</span>
        <span style={styles.footerDot} />
        <a href="/portal/oxmaint/dashboard" style={styles.footerLink}>Open the portal</a>
      </footer>
    </div>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 35%, #fdf4ff 100%)',
    // No fontFamily here on purpose: an inline style outranks the next/font
    // class on the same element, so setting it would silently undo Plex.
  },

  // ── Ambient background ────────────────────────────────────────────
  ambient: { position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' },
  orb: { position: 'absolute', width: 520, height: 520, borderRadius: '50%', filter: 'blur(120px)', opacity: 0.55 },
  orbA: { background: 'radial-gradient(circle, #6366f1 0%, transparent 65%)', top: -180, left: -120, animation: 'floatA 18s ease-in-out infinite' },
  orbB: { background: 'radial-gradient(circle, #ec4899 0%, transparent 65%)', bottom: -220, right: -160, animation: 'floatB 22s ease-in-out infinite' },
  orbC: { background: 'radial-gradient(circle, #14b8a6 0%, transparent 65%)', top: '40%', left: '55%', width: 380, height: 380, animation: 'floatC 26s ease-in-out infinite' },
  noise: {
    position: 'absolute', inset: 0,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 200 200%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%272%27/%3E%3C/filter%3E%3Crect width=%27100%27 height=%27100%27 filter=%27url(%23n)%27 opacity=%270.55%27/%3E%3C/svg%3E")',
    opacity: 0.04,
    mixBlendMode: 'overlay',
  },

  // ── Top bar (glass) ───────────────────────────────────────────────
  topBar: {
    position: 'sticky', top: 0, zIndex: 50,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 32px',
    background: 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderBottom: '1px solid rgba(255,255,255,0.55)',
    boxShadow: '0 1px 0 rgba(15,23,42,0.04), 0 8px 20px rgba(15,23,42,0.04)',
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  mark: {
    width: 'auto', height: 46, objectFit: 'contain', display: 'block',
    filter: `drop-shadow(0 3px 8px ${ACCENT}38)`,
  },
  // Hairline that separates the mark from the wordmark, so the two read as
  // logo + title rather than one crowded cluster.
  rule: { width: 1, height: 30, background: 'linear-gradient(180deg, transparent, rgba(15,23,42,0.14), transparent)' },
  brandName: {
    fontSize: 17, fontWeight: 600, color: '#0f172a',
    letterSpacing: '-0.02em', lineHeight: 1.15,
  },
  brandThin: { fontWeight: 400, color: ACCENT },
  brandSub: { marginTop: 3, display: 'flex', alignItems: 'center', gap: 7 },
  adminPill: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 8px 2px 6px',
    background: `linear-gradient(135deg, ${ACCENT}, #4338ca)`,
    color: '#fff', borderRadius: 999,
    fontWeight: 600, fontSize: 9.5, letterSpacing: '0.12em',
    boxShadow: `0 2px 6px ${ACCENT}33`,
  },
  pillDot: { width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'pulse 1.8s ease-in-out infinite' },
  metaText: { fontSize: 11.5, fontWeight: 400, color: '#64748b', letterSpacing: '0.005em' },
  metaDot: { width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' },
  clock: { fontSize: 11.5, fontWeight: 500, color: '#475569', fontVariantNumeric: 'tabular-nums' },
  topRight: { display: 'flex', alignItems: 'center', gap: 10 },
  // Quieter than Sign Out on purpose. Both leave this page, and the one that
  // ends the session is the one that should look like it does.
  backBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '9px 14px',
    background: 'rgba(255,255,255,0.55)',
    color: '#334155', textDecoration: 'none',
    border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10,
    fontSize: 12.5, fontWeight: 600, letterSpacing: '0.005em',
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
    transition: 'all 0.2s ease',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '9px 15px',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 12.5, fontWeight: 600, letterSpacing: '0.005em', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(220,38,38,0.20), inset 0 1px 0 rgba(255,255,255,0.15)',
    transition: 'all 0.2s ease',
  },

  // ── Grid wrapper + cursor spotlight ───────────────────────────────
  gridWrap: {
    position: 'relative', zIndex: 1,
    maxWidth: 1400, margin: '0 auto',
    padding: '28px 28px 20px',
  },
  spotlight: {
    position: 'absolute', top: 0, left: 0,
    width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
    pointerEvents: 'none', zIndex: 0,
    transition: 'transform 0.15s ease-out',
  },

  // ── Section heading ───────────────────────────────────────────────
  // What the search bar used to occupy. The count stays because it is the one
  // thing that bar told you that a glance at the grid does not, once the grid
  // is longer than a screen.
  sectionHead: {
    position: 'relative', zIndex: 2,
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
  },
  sectionTitle: {
    margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em',
  },
  sectionCount: {
    fontSize: 11, fontWeight: 600, color: '#475569',
    padding: '3px 9px', borderRadius: 999,
    background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(255,255,255,0.75)',
    fontVariantNumeric: 'tabular-nums',
  },

  // ── Grid ──────────────────────────────────────────────────────────
  // Fixed-width tracks, left-aligned: a lone card keeps a card's proportions
  // instead of stretching to the full 1400px.
  grid: {
    position: 'relative', zIndex: 1,
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 330px))',
    justifyContent: 'start', gap: 18,
  },

  // ── Glass card ────────────────────────────────────────────────────
  card: {
    position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    padding: '22px 22px 18px',
    background: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(18px) saturate(180%)',
    WebkitBackdropFilter: 'blur(18px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.65)',
    borderRadius: 18,
    textDecoration: 'none', color: 'inherit', cursor: 'pointer',
    boxShadow: '0 8px 30px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
    animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both',
    minHeight: 180,
  },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, opacity: 0.9 },
  cardWash:   { position: 'absolute', inset: 0, pointerEvents: 'none' },

  cardHeader: {
    position: 'relative', zIndex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, marginTop: 6,
  },
  cardIcon: {
    width: 50, height: 50, borderRadius: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cardArrow: {
    width: 30, height: 30, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.2s ease',
  },

  cardTitle: {
    position: 'relative', zIndex: 1,
    margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#0f172a',
    letterSpacing: '-0.015em', lineHeight: 1.2,
  },
  cardTag: {
    position: 'relative', zIndex: 1,
    margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.55, fontWeight: 500,
    minHeight: 36,
  },

  cardFooter: {
    position: 'relative', zIndex: 1,
    marginTop: 14, paddingTop: 12,
    borderTop: '1px solid rgba(15,23,42,0.06)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  cardRoute: { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 10, color: '#64748b', fontWeight: 600 },
  dot: { width: 6, height: 6, borderRadius: '50%' },
  cardCta: { fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase' },

  footer: {
    position: 'relative', zIndex: 1,
    padding: '24px 28px 30px', textAlign: 'center', fontSize: 11, color: '#94a3b8',
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  footerDot: { width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' },
  footerLink: { color: ACCENT, fontWeight: 600, textDecoration: 'none' },
}
