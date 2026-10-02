'use client'

// The header, in the shape the FSM portal settled on.
//
// One bold product name on the left and nothing else there — the section name
// and the property both used to sit beside it, and both were already on the
// page: the section is the 30px heading directly below, and the property is in
// the profile. A header that repeats the two lines under it spends the most
// permanent strip on the screen saying what the page already says. That, and a
// customer's name in the chrome is the thing that has had to come out of every
// portal on this platform.
//
// On the right, the row of controls the product has: what the data is, search,
// alerts, the assistant, full screen, and who is signed in.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sectionIcon, MENU } from '../lib/nav'
import { useStore } from '../lib/store'
import { apiUrl } from '@/lib/apiPath'
import {
  USER, ORG, KPI, WORK_ORDERS, PARTS, PM_SCHEDULES, SUITES, REQUESTS,
  isPast, OPEN_STATUS,
} from '../lib/data'

const ACCENT = '#15227a'

// What a hotel engineer would want interrupting them, which is not a plant's
// list. A guest waiting at the desk outranks a stockroom line, and a slipped
// suite outranks both because it is the only one already a failure.
function buildAlerts() {
  const overduePM = PM_SCHEDULES.filter((p) => isPast(p.next_due))
  const critical = WORK_ORDERS.filter((w) => OPEN_STATUS.includes(w.status) && w.priority === 'Critical')
  const out = PARTS.filter((p) => p.status === 'Out of Stock')
  const slipped = SUITES.filter((s) => s.state === 'Overdue')
  const guest = REQUESTS.filter((r) => r.status === 'Open' && String(r.source).startsWith('Front desk'))

  return [
    guest.length && { id: 'a0', type: 'critical', title: `${guest.length} guest requests waiting`, body: guest[0].title + (guest[0].suite_number ? ` — Suite ${guest[0].suite_number}` : ''), to: 'requests' },
    slipped.length && { id: 'a1', type: 'warning', title: `${slipped.length} suites past their rotation date`, body: `Suite ${slipped[0].suite_number} is ${slipped[0].overdue_days} days late.`, to: 'suite-rotation' },
    critical.length && { id: 'a2', type: 'critical', title: `${critical.length} critical work orders open`, body: critical[0].title, to: 'work-orders' },
    KPI.work_orders_overdue && { id: 'a3', type: 'warning', title: `${KPI.work_orders_overdue} work orders overdue`, body: 'Past their due date and still open.', to: 'work-orders' },
    overduePM.length && { id: 'a4', type: 'warning', title: `${overduePM.length} PM schedules overdue`, body: overduePM[0].schedule_name, to: 'pm-schedules' },
    out.length && { id: 'a5', type: 'critical', title: `${out.length} parts out of stock`, body: out[0].part_name, to: 'parts' },
    KPI.assets_down && { id: 'a6', type: 'warning', title: `${KPI.assets_down} assets down`, body: 'Out of service until a work order closes.', to: 'assets' },
  ].filter(Boolean)
}

// `className` is taken so the shell can mark this for printing *on this
// element*. Wrapping it in a marked div instead is what stopped it sticking:
// a sticky element resolves against its nearest scrolling ancestor, and a plain
// wrapper only as tall as the header gives it nowhere to stick to — so it
// scrolled away with the page.
export default function TopBar({ onOpenAssistant, className }) {
  const router = useRouter()
  const { persisted } = useStore() || {}

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showNotif, setShowNotif] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [read, setRead] = useState([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const notifRef = useRef(null)
  const profileRef = useRef(null)

  const alerts = useMemo(buildAlerts, [])
  const unread = alerts.filter((a) => !read.includes(a.id)).length

  const go = (key) => { setSearchOpen(false); setShowNotif(false); setShowProfile(false); router.push(`/portal/hospitality/${key}`) }

  // Twenty-two sections is past the point where scanning the sidebar is faster
  // than typing, so the palette covers all of them and their keywords.
  const searchable = useMemo(
    () => MENU.flatMap((g) => (g.single ? [{ ...g, group: g.label }] : g.children.map((c) => ({ ...c, group: g.label })))),
    [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return searchable
    return searchable.filter((s) => s.label.toLowerCase().includes(q) || (s.kw || '').includes(q))
  }, [query, searchable])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((v) => !v) }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Tracked from the browser's own event, not from our click. Escape and F11
  // exit full screen without going through the button, and a state we set
  // ourselves would then be lying about which icon to show.
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }

  const signOut = async () => {
    try {
      const res = await fetch(apiUrl('/api/logout'), { method: 'POST' })
      const data = await res.json().catch(() => ({ redirectTo: '/admin' }))
      window.location.href = data.redirectTo || '/admin'
    } catch { window.location.href = '/admin' }
  }

  const typeColor = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' }

  return (
    <div className={className} style={styles.bar}>
      <span style={styles.wordmark}>Oxmaint AI</span>

      <div style={{ flex: '1 1 auto' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* What the data is. The property's own records do not exist, so saying
            "modelled" on every screen is more honest than a green live dot over
            numbers nobody at the hotel has ever seen. */}
        <span style={styles.pill} title="Modelled from public property details and industry-standard intervals — not this property's own records">
          <span style={styles.pillDot} />
          Modelled property data
        </span>

        {persisted === false && (
          <span style={styles.readonly} title="No database is configured, so new records last until you reload.">
            Read-only
          </span>
        )}

        <button onClick={() => setSearchOpen(true)} style={styles.iconBtn} title="Search (Ctrl+K)">
          <Icon><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>
        </button>

        <div ref={notifRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowNotif((v) => !v)} style={styles.iconBtn} title="Alerts">
            <Icon><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></Icon>
            {unread > 0 && <span style={styles.badge}>{unread}</span>}
          </button>
          {showNotif && (
            <div style={styles.dropdown}>
              <div style={styles.dropHead}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>Alerts</span>
                <button onClick={() => setRead(alerts.map((a) => a.id))} style={styles.linkBtn}>Mark all read</button>
              </div>
              <div style={{ maxHeight: 330, overflowY: 'auto' }}>
                {alerts.map((a) => (
                  <button key={a.id} onClick={() => { setRead((p) => [...new Set([...p, a.id])]); go(a.to) }} style={styles.notifRow}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: typeColor[a.type], marginTop: 5, flexShrink: 0 }} />
                    <span style={{ minWidth: 0, textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: read.includes(a.id) ? 500 : 700, color: '#0f172a' }}>{a.title}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{a.body}</span>
                    </span>
                  </button>
                ))}
                {!alerts.length && <div style={{ padding: '20px 14px', fontSize: 12.5, color: '#94a3b8', textAlign: 'center' }}>Nothing needs attention.</div>}
              </div>
            </div>
          )}
        </div>

        <button onClick={onOpenAssistant} style={styles.iconBtn} title="Ask about this property">
          <Icon><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon>
        </button>

        <button onClick={toggleFullscreen} style={styles.iconBtn} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
          {isFullscreen
            ? <Icon><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></Icon>
            : <Icon><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></Icon>}
        </button>

        <div ref={profileRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowProfile((v) => !v)} style={styles.avatar} title={USER.name}>{USER.initials}</button>
          {showProfile && (
            <div style={{ ...styles.dropdown, width: 236 }}>
              {/* The property's name lives here, in the profile, the way the
                  live product has it — and not beside the wordmark. */}
              <div style={{ padding: '11px 13px', borderBottom: '1px solid #e8ecf1' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{USER.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{USER.email}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{USER.role_name} · {ORG.organization_name}</div>
              </div>
              <button onClick={() => go('settings')} style={styles.menuRow}>Settings</button>
              <button onClick={() => go('teams')} style={styles.menuRow}>Teams</button>
            </div>
          )}
        </div>

        {/* Signing out is its own button, not a row inside the profile menu.
            The sibling portal has it that way and it is the right call: leaving
            is the one action somebody needs to find without opening anything
            first, and it is the one that should look like what it does. */}
        <button onClick={signOut} style={styles.exit} title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      {searchOpen && (
        <div style={styles.overlay} onClick={() => setSearchOpen(false)}>
          <div style={styles.palette} onClick={(e) => e.stopPropagation()}>
            <div style={styles.paletteHead}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].key) }}
                placeholder="Search screens…" style={styles.paletteInput}
              />
              <kbd style={styles.kbd}>Esc</kbd>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
              {results.map((r) => (
                <button key={r.key} onClick={() => go(r.key)} style={styles.paletteRow}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f7fb' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ display: 'flex', width: 18, flexShrink: 0 }}>{sectionIcon(r.key, '#64748b')}</span>
                  <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{r.group}</span>
                </button>
              ))}
              {!results.length && <div style={{ padding: '26px 14px', fontSize: 12.5, color: '#94a3b8', textAlign: 'center' }}>Nothing matches “{query}”.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Icon({ children }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const styles = {
  bar: {
    position: 'sticky', top: 0, zIndex: 100,
    // 64 and never wrapping, matching the product's h-16 header. A bar that
    // reflows to two rows on a narrow window moves everything sticky under it.
    height: 64, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap',
    padding: '0 24px', background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    borderBottom: '1px solid #e4e9f0',
  },
  wordmark: { fontSize: 18, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
    borderRadius: 999, background: '#fffbeb', border: '1px solid #fde68a',
    color: '#b45309', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
  },
  pillDot: { width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' },
  readonly: {
    display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
    borderRadius: 999, background: '#fef2f2', border: '1px solid #fecaca',
    color: '#b91c1c', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
  },
  iconBtn: {
    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 9, background: '#fff',
    border: '1px solid #e4e9f0', cursor: 'pointer', padding: 0,
  },
  badge: {
    position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px',
    borderRadius: 999, background: '#ef4444', color: '#fff',
    fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', border: '1px solid #d6ddff',
    background: '#e8ecff', color: ACCENT, fontSize: 12, fontWeight: 800,
    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
  dropdown: {
    position: 'absolute', top: 40, right: 0, width: 312, background: '#fff',
    border: '1px solid #e8ecf1', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,0.14)',
    overflow: 'hidden', zIndex: 300,
  },
  dropHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderBottom: '1px solid #e8ecf1' },
  linkBtn: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: ACCENT },
  notifRow: {
    display: 'flex', gap: 9, width: '100%', padding: '10px 13px', background: 'none',
    border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  },
  menuRow: {
    display: 'block', width: '100%', padding: '10px 13px', background: 'none', border: 'none',
    textAlign: 'left', fontSize: 12.5, color: '#334155', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 400,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
  },
  palette: { width: 'min(560px, 92vw)', background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.3)', overflow: 'hidden' },
  paletteHead: { display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderBottom: '1px solid #e8ecf1' },
  paletteInput: { flex: 1, border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', color: '#0f172a', background: 'transparent' },
  kbd: { fontSize: 10, fontWeight: 700, color: '#94a3b8', border: '1px solid #e4e9f0', borderRadius: 5, padding: '2px 5px' },
  paletteRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px',
    background: 'transparent', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
  },
  exit: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#ef4444', border: 'none', borderRadius: 9, height: 32, width: 34,
    cursor: 'pointer', flexShrink: 0, padding: 0,
  },
}
