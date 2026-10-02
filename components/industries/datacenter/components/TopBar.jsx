'use client'

// The header: whose product this is, and the controls that belong to the whole
// portal rather than to one screen.
//
// Where you are is not in here. The product's own header carries the name and
// nothing else, and this one had grown a section title and a programme line as
// well — both of which the page repeats immediately below, as its heading and
// its subtitle.
//
// The site picker is the one control here that changes what the page below is
// counting, so it lives in a context rather than in each screen's own state —
// pick Ashburn on the asset register, walk to Alerts, and the filter is still
// on. A picker that resets between pages teaches an audience not to trust it.
//
// New is here for the same reason. Three of this portal's thirty-eight screens
// take input, and they sit in two different menu groups — so "where do I enter
// something?" had no answer short of knowing the menu. The header is the one
// strip present on every screen, so the answer lives on it, and the menu says
// what each one records rather than only its own name.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSite } from '../lib/siteStore'
import { useRiskStore } from '../lib/store'
import { buildNotifications } from '../lib/notifications'
import { CREATE_ACTIONS, READ_ONLY_NOTE } from '../lib/createActions'
import { apiUrl } from '@/lib/apiPath'

// The dot colour reads severity at a glance in the bell's dropdown, the same
// mapping the Notifications screen uses.
const SEV_DOT = { Critical: '#ef4444', High: '#f59e0b', Warning: '#f59e0b', Medium: '#3b82f6', Low: '#94a3b8' }
const BADGE_TONE = {
  red: { color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' },
  amber: { color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' },
  blue: { color: '#1d4ed8', background: '#eff6ff', borderColor: '#bfdbfe' },
  green: { color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' },
  grey: { color: '#475569', background: '#f8fafc', borderColor: '#e8ecf1' },
}

const GLYPHS = {
  clipboard: <><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
}

export default function TopBar({ onOpenAssistant }) {
  const { siteId, setSiteId, sites, scope } = useSite()
  const riskStore = useRiskStore()
  const router = useRouter()
  const [isFullscreen, setFullscreen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const createRef = useRef(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // What the portal has recorded against each auditor finding, so a risk that
  // has been resolved in the AI Auditor drops out of the bell too. Starts empty
  // and identical on the server and first paint; the store fills it after mount.
  const overlays = useMemo(() => {
    const m = {}
    for (const r of riskStore.created) if (r.recId) m[r.recId] = r
    return m
  }, [riskStore.created])

  const { items } = useMemo(() => buildNotifications({ scope, overlays }), [scope, overlays])
  const top = items.slice(0, 3)

  // Which attention items the operator has already seen, so the count reflects
  // what is new. Read from localStorage after mount — reading it during render
  // would diverge from the server paint — so a first visit shows the full count.
  const [seen, setSeen] = useState(() => new Set())
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('dc_notif_seen')
      if (raw) setSeen(new Set(JSON.parse(raw)))
    } catch { /* private mode, cleared storage — the full count is a fine default */ }
  }, [])

  const badge = items.filter((n) => n.attention && !seen.has(n.id)).length

  const markSeen = (ids) => setSeen((prev) => {
    const next = new Set(prev)
    ids.forEach((id) => next.add(id))
    try { window.localStorage.setItem('dc_notif_seen', JSON.stringify([...next])) } catch { /* ignore */ }
    return next
  })

  // Clicking a notification opens the Notifications screen focused on that row,
  // as asked — the bell is a peek, the screen is where you act.
  const openNotif = (n) => {
    markSeen([n.id])
    setNotifOpen(false)
    router.push(`/portal/datacenter/notifications?focus=${encodeURIComponent(n.id)}`)
  }
  const seeAll = () => { setNotifOpen(false); router.push('/portal/datacenter/notifications') }
  const markAllRead = () => markSeen(items.filter((n) => n.attention).map((n) => n.id))

  // Closes on a click anywhere else and on Escape. A menu that only closes by
  // reopening it is one that sits over the screen while somebody tries to read
  // what is underneath.
  useEffect(() => {
    if (!createOpen) return undefined
    const onDown = (e) => { if (!createRef.current?.contains(e.target)) setCreateOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setCreateOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [createOpen])

  // The notifications dropdown closes the same way — a click outside or Escape.
  useEffect(() => {
    if (!notifOpen) return undefined
    const onDown = (e) => { if (!notifRef.current?.contains(e.target)) setNotifOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setNotifOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifOpen])

  // Read from the document rather than toggled state: the user can leave full
  // screen with Escape without touching the button, and a button that then
  // still says "Exit full screen" is lying about the state of the window.
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }

  const exit = async () => {
    try {
      const res = await fetch(apiUrl('/api/logout'), { method: 'POST' })
      const data = await res.json().catch(() => ({ redirectTo: '/admin' }))
      window.location.href = data.redirectTo || '/admin'
    } catch {
      window.location.href = '/admin'
    }
  }

  return (
    <div style={styles.bar}>
      {/* Just the product name, as the real header has it — one bold label in
          the primary colour and nothing else on the left.
          The section name and the programme line used to sit here too. Both
          were already on the page: the section is the 30px heading directly
          below, and the programme is its subtitle. A header that repeats the
          two lines under it is spending the most permanent strip on the screen
          saying what the page already says. */}
      <span style={styles.wordmark}>Oxmaint AI</span>

      <div style={{ flex: '1 1 auto' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span ref={createRef} style={{ position: 'relative' }}>
          <button onClick={() => setCreateOpen((v) => !v)} style={styles.create}
            aria-haspopup="menu" aria-expanded={createOpen} title="What this portal can record">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New
          </button>

          {createOpen && (
            <span style={styles.menu} role="menu">
              <span style={styles.menuHead}>This portal records three things</span>
              {CREATE_ACTIONS.map((a) => (
                <button key={a.key} role="menuitem" style={styles.menuItem}
                  onClick={() => { setCreateOpen(false); router.push(a.href) }}>
                  <span style={styles.menuIcon}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15227a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {GLYPHS[a.icon]}
                    </svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={styles.menuLabel}>{a.label}</span>
                    <span style={styles.menuWhat}>{a.what}</span>
                    <span style={styles.menuLands}>Saved to {a.lands}</span>
                  </span>
                </button>
              ))}
              <span style={styles.menuFoot}>{READ_ONLY_NOTE}</span>
            </span>
          )}
        </span>

        {/* "Illustrative" is the workbooks' own word for this data, and the PoC
            has not started. Saying so on every screen is more honest than a
            green "live" dot over sample rows. */}
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={styles.select} title="Filter every screen by site">
          <option value="all">All sites ({sites.length})</option>
          {sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.siteId} — {s.siteName}</option>)}
        </select>

        <span ref={notifRef} style={{ position: 'relative' }}>
          <button onClick={() => setNotifOpen((v) => !v)} style={{ ...styles.iconBtn, position: 'relative' }}
            aria-haspopup="menu" aria-expanded={notifOpen} title="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {badge > 0 && <span style={styles.bellDot}>{badge > 9 ? '9+' : badge}</span>}
          </button>

          {notifOpen && (
            <span style={styles.notifMenu} role="menu">
              <span style={styles.notifHead}>
                <span style={styles.notifTitle}>Notifications</span>
                {badge > 0
                  ? <span style={styles.notifUnread}>{badge} unread</span>
                  : <span style={styles.notifClear}>All caught up</span>}
              </span>

              {top.length === 0 ? (
                <span style={styles.notifEmpty}>Nothing needs attention right now.</span>
              ) : top.map((n) => (
                <button key={n.id} role="menuitem" style={styles.notifItem} onClick={() => openNotif(n)}>
                  <span style={{ ...styles.notifDot, background: SEV_DOT[n.severity] || '#94a3b8' }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={styles.notifRowTop}>
                      <span style={styles.notifChannel}>{n.channel}</span>
                      <span style={{ ...styles.notifBadge, ...(BADGE_TONE[n.tone] || BADGE_TONE.grey) }}>{n.badge}</span>
                    </span>
                    <span style={styles.notifAsset}>{n.headline}</span>
                    <span style={styles.notifDetail}>{n.detail}</span>
                    <span style={styles.notifWhen}>{[n.site, n.whenText !== '—' ? n.whenText : null].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              ))}

              <span style={styles.notifFoot}>
                <button style={styles.notifSeeAll} onClick={seeAll}>See all notifications</button>
                {badge > 0 && <button style={styles.notifMark} onClick={markAllRead}>Mark all read</button>}
              </span>
            </span>
          )}
        </span>

        <button onClick={onOpenAssistant} style={styles.iconBtn} title="Ask about this PoC">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <button onClick={toggleFullscreen} style={styles.iconBtn} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          )}
        </button>

        <button onClick={exit} title="Back to the console" style={styles.exit}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const styles = {
  bar: {
    position: 'sticky', top: 0, zIndex: 100,
    // 64px and never wrapping, matching the product's h-16 header. A bar that
    // reflows to two rows on a narrow window moves everything sticky under it.
    height: 64, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap',
    padding: '0 24px', background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    borderBottom: '1px solid #e4e9f0',
  },
  wordmark: { fontSize: 18, fontWeight: 700, color: '#15227a', whiteSpace: 'nowrap' },
  create: {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 13px',
    fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
    color: '#fff', background: '#15227a', border: '1px solid #15227a',
    borderRadius: 9, cursor: 'pointer',
  },
  menu: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 120,
    display: 'flex', flexDirection: 'column', width: 330, padding: 6,
    background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12,
    boxShadow: '0 16px 40px rgba(15,23,42,0.16)',
  },
  menuHead: {
    padding: '8px 10px 6px', fontSize: 10.5, fontWeight: 700,
    letterSpacing: '.06em', textTransform: 'uppercase', color: '#94a3b8',
  },
  menuItem: {
    display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%',
    padding: '9px 10px', background: 'none', border: 'none', borderRadius: 9,
    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
  },
  menuIcon: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8, background: '#eef2ff', flexShrink: 0,
  },
  menuLabel: { display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a' },
  menuWhat: { display: 'block', fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 1.45 },
  menuLands: { display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 3, fontWeight: 600 },
  menuFoot: {
    padding: '9px 10px 6px', marginTop: 4, borderTop: '1px solid #eef1f6',
    fontSize: 11, color: '#94a3b8', lineHeight: 1.5,
  },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
    borderRadius: 999, background: '#fffbeb', border: '1px solid #fde68a',
    color: '#b45309', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
  },
  pillDot: { width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' },
  select: {
    padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
    border: '1px solid #e4e9f0', borderRadius: 9, background: '#fff', color: '#15227a',
    outline: 'none', cursor: 'pointer', maxWidth: 250,
  },
  iconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 9, background: '#fff',
    border: '1px solid #e4e9f0', cursor: 'pointer', padding: 0,
  },
  bellDot: {
    position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#ef4444', color: '#fff', fontSize: 9.5, fontWeight: 800,
    borderRadius: 999, border: '2px solid #fff', lineHeight: 1,
  },
  notifMenu: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 120,
    display: 'flex', flexDirection: 'column', width: 348, padding: 6,
    background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12,
    boxShadow: '0 16px 40px rgba(15,23,42,0.16)',
  },
  notifHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px 8px', borderBottom: '1px solid #eef1f6', marginBottom: 4,
  },
  notifTitle: { fontSize: 13.5, fontWeight: 800, color: '#0f172a' },
  notifUnread: {
    fontSize: 10.5, fontWeight: 800, color: '#b91c1c', background: '#fef2f2',
    padding: '2px 8px', borderRadius: 999,
  },
  notifClear: { fontSize: 10.5, fontWeight: 700, color: '#047857' },
  notifEmpty: { padding: '16px 12px', fontSize: 12.5, color: '#94a3b8', fontWeight: 500 },
  notifItem: {
    display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%',
    padding: '9px 10px', background: 'none', border: 'none', borderRadius: 9,
    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
  },
  notifDot: { width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0 },
  notifRowTop: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  notifChannel: {
    fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8',
  },
  notifBadge: {
    display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 999,
    border: '1px solid', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap',
  },
  notifAsset: { display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 },
  notifDetail: {
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
    fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 1.45,
  },
  notifWhen: { display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 4, fontWeight: 600 },
  notifFoot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '8px 6px 4px', marginTop: 4, borderTop: '1px solid #eef1f6',
  },
  notifSeeAll: {
    flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    color: '#fff', background: '#15227a', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  notifMark: {
    padding: '8px 10px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
    color: '#475569', background: '#fff', border: '1px solid #e4e9f0', borderRadius: 8, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  exit: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#ef4444', border: 'none', borderRadius: 9, height: 32, width: 34,
    cursor: 'pointer', flexShrink: 0,
  },
}
