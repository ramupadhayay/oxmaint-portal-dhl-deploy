'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { sectionIcon } from '../lib/nav'
import { useSite } from '../lib/siteStore'
import { useStore } from '../lib/store'
import { useVisibility } from '../lib/visibility'
import { USER, ORG, KPI, WORK_ORDERS, PARTS, PM_SCHEDULES, isPast, OPEN_STATUS } from '../lib/data'
import { apiUrl } from '@/lib/apiPath'

const ACCENT = '#15227a'
const ACCENT_LIGHT = '#e8ecff'

// The alerts are computed from the same data the screens show, not written by
// hand. A notification that says three parts are out of stock, next to an
// inventory page listing five, is the kind of contradiction an audience spots
// straight away — and it only happens when the two are authored separately.
function buildAlerts() {
  const overduePM = PM_SCHEDULES.filter((p) => isPast(p.next_due))
  const critical = WORK_ORDERS.filter((w) => OPEN_STATUS.includes(w.status) && w.priority === 'Critical')
  const out = PARTS.filter((p) => p.status === 'Out of Stock')

  return [
    critical.length && { id: 'a1', type: 'critical', title: `${critical.length} critical work orders open`, body: critical[0].title + ' — ' + critical[0].asset_name, to: 'work-orders' },
    KPI.work_orders_overdue && { id: 'a2', type: 'warning', title: `${KPI.work_orders_overdue} work orders overdue`, body: 'Past their due date and still open.', to: 'work-orders' },
    overduePM.length && { id: 'a3', type: 'warning', title: `${overduePM.length} PM schedules overdue`, body: overduePM[0].schedule_name, to: 'pm-schedules' },
    out.length && { id: 'a4', type: 'critical', title: `${out.length} parts out of stock`, body: out[0].part_name + ' — ' + out[0].part_number, to: 'parts' },
    KPI.assets_down && { id: 'a5', type: 'warning', title: `${KPI.assets_down} assets down`, body: 'Not available for production.', to: 'assets' },
    { id: 'a6', type: 'info', title: 'PM compliance at ' + KPI.pm_compliance + '%', body: 'Rolling measure across ' + KPI.pm_total + ' schedules.', to: 'dashboard' },
  ].filter(Boolean)
}

export default function TopBar({ onMenu }) {
  const router = useRouter()
  const { siteId, setSiteId, sites } = useSite()
  const { persisted } = useStore() || {}
  const { menu } = useVisibility()

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

  // The palette searches only what the menu shows. A module switched off in
  // Settings that still turns up under Ctrl+K has not really been switched off.
  const searchable = useMemo(
    () => menu.flatMap((g) => (
      // A single-screen entry is its own row in the menu and has no children.
      g.single ? [{ ...g, group: g.label }] : g.children.map((c) => ({ ...c, group: g.label }))
    )),
    [menu])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return searchable
    return searchable.filter((r) => r.label.toLowerCase().includes(q) || r.group.toLowerCase().includes(q) || (r.kw || '').includes(q))
  }, [query, searchable])

  const go = (key) => { setSearchOpen(false); setQuery(''); setShowNotif(false); router.push('/portal/oxmaint/' + key) }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setSearchOpen((v) => !v) }
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

  const handleLogout = async () => {
    const res = await fetch(apiUrl('/api/logout'), { method: 'POST' })
    const data = await res.json().catch(() => ({ redirectTo: '/login' }))
    window.location.href = data.redirectTo || '/login'
  }

  const typeColor = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' }

  return (
    <div className="ox-topbar" style={styles.bar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <button className="ox-hamburger" onClick={onMenu} style={{ ...styles.iconBtn, display: 'none' }} title="Menu" aria-label="Open menu">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span style={styles.wordmark}>Oxmaint <span style={{ color: '#f5b700' }}>AI</span></span>
        {/* Whether what you do here is being kept. Silence about it is worse
            than either answer: someone raises a work order, the row appears,
            and only a refresh tells them it was never stored. */}
        {persisted === false && (
          <span style={styles.readonly} title="No database is configured, so new records last until you reload.">
            Read-only
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <button onClick={() => setSearchOpen(true)} style={styles.searchBtn} title="Search (Ctrl+K)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <span className="ox-hide-md" style={{ color: '#94a3b8', fontSize: 12 }}>Search</span>
          <kbd className="ox-hide-md" style={styles.kbd}>Ctrl K</kbd>
        </button>

        <button className="ox-hide-md" onClick={toggleFullscreen} style={styles.iconBtn} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
          )}
        </button>

        <div ref={notifRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowNotif((v) => !v)} style={styles.iconBtn} title="Alerts">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
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
              </div>
            </div>
          )}
        </div>

        {/* Language and site sit to the right of the icons, as the live product
            has them — the site picker last, because it is the control that
            changes what every number on the page means. */}
        <select className="ox-hide-md" value="EN" onChange={() => {}} style={styles.langSelect} title="Language">
          <option value="EN">EN</option>
        </select>

        <div className="ox-hide-sm" style={styles.sitePicker}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
          </svg>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={styles.siteSelect} title="Filter the whole portal by site">
            <option value="all">All Sites</option>
            {sites.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
          </select>
        </div>

        <div ref={profileRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowProfile((v) => !v)} style={styles.avatar} title={USER.name}>{USER.initials}</button>
          {showProfile && (
            <div style={{ ...styles.dropdown, width: 232 }}>
              <div style={{ padding: '11px 13px', borderBottom: '1px solid #e8ecf1' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{USER.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{USER.email}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{USER.role_name} · {ORG.organization_name}</div>
              </div>
              <button onClick={() => { setShowProfile(false); go('settings') }} style={styles.menuRow}>Settings</button>
              <button onClick={() => { setShowProfile(false); go('subscription') }} style={styles.menuRow}>Subscription</button>
              <button onClick={handleLogout} style={{ ...styles.menuRow, color: '#dc2626', borderTop: '1px solid #e8ecf1' }}>Sign out</button>
            </div>
          )}
        </div>

        <button className="ox-hide-sm" onClick={handleLogout} style={styles.logoutBtn} title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      {searchOpen && (
        <div style={styles.overlay} onClick={() => setSearchOpen(false)}>
          <div style={styles.palette} onClick={(e) => e.stopPropagation()}>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jump to a section…" style={styles.paletteInput} />
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
              {results.map((r) => (
                <button key={r.key} onClick={() => go(r.key)} style={styles.paletteRow}
                  onMouseEnter={(e) => { e.currentTarget.style.background = ACCENT_LIGHT }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  {sectionIcon(r.key, '#64748b')}
                  <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{r.group}</span>
                </button>
              ))}
              {!results.length && <div style={{ padding: 22, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>No section matches “{query}”.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  bar: { display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: '0 18px 0 36px', background: '#fff', borderBottom: '1px solid #e8ecf1', position: 'sticky', top: 0, zIndex: 150 },
  wordmark: { fontSize: 15, fontWeight: 800, color: '#15227a', letterSpacing: -0.2 },
  readonly: { fontSize: 9.5, fontWeight: 800, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'help' },
  searchBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', background: '#f8fafc', border: '1px solid #e8ecf1', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' },
  kbd: { fontSize: 9.5, fontWeight: 700, color: '#94a3b8', background: '#fff', border: '1px solid #e8ecf1', borderRadius: 4, padding: '1px 5px' },
  sitePicker: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 9px', height: 34, background: '#fff', border: '1px solid #e8ecf1', borderRadius: 9 },
  siteSelect: { border: 'none', outline: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: '#334155', fontFamily: 'inherit', cursor: 'pointer', maxWidth: 132 },
  langSelect: { height: 34, padding: '0 7px', fontSize: 12, fontWeight: 700, color: '#334155', background: '#fff', border: '1px solid #e8ecf1', borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' },
  iconBtn: { position: 'relative', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e8ecf1', borderRadius: 9, cursor: 'pointer' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', border: 'none', borderRadius: 9, height: 34, padding: '0 12px', cursor: 'pointer', flexShrink: 0 },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  dropdown: { position: 'absolute', top: 42, right: 0, width: 316, background: '#fff', border: '1px solid #e8ecf1', borderRadius: 12, boxShadow: '0 10px 30px rgba(15,23,42,0.12)', overflow: 'hidden', zIndex: 300 },
  dropHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderBottom: '1px solid #e8ecf1' },
  linkBtn: { background: 'none', border: 'none', color: ACCENT, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  notifRow: { display: 'flex', gap: 9, width: '100%', padding: '10px 13px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  menuRow: { display: 'block', width: '100%', padding: '10px 13px', background: 'none', border: 'none', textAlign: 'left', fontSize: 12.5, color: '#334155', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.32)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '13vh', zIndex: 400 },
  palette: { width: 'min(560px,92vw)', background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.25)', overflow: 'hidden' },
  paletteInput: { width: '100%', boxSizing: 'border-box', padding: '15px 18px', fontSize: 14.5, border: 'none', borderBottom: '1px solid #e8ecf1', outline: 'none', fontFamily: 'inherit', color: '#0f172a' },
  paletteRow: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .1s' },
}
