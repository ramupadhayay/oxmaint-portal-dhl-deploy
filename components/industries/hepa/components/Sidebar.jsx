'use client'

import { useMemo, useState } from 'react'
import { sectionIcon, MENU } from '../lib/nav'
import { OxmaintBrandCard } from './Logo'
import { useOrgBranding } from '../lib/store'
import { ORG } from '../lib/data/index.js'
import { useRole } from '../lib/roles'

// The CMMS portal reads its menu through a visibility provider, so an
// organisation can switch modules off. This portal's menu is eleven sections a
// 98-suite hotel runs, and hiding some of those would leave a menu shorter than
// the reason for having one — so it comes straight from nav.jsx.

const ACCENT = '#15227a'
const ACCENT_LIGHT = '#e8ecff'

// Group headings are rows with an icon and a readable label, not 9.5px
// uppercase text in pale grey.
//
// That earlier styling came from treating them as captions. They are not
// captions — they are the top level of the menu, and the thing a person aims
// at. At 9.5px in #94a3b8 they measured under 2:1 against white, which is not
// a preference argument: it is below the floor for text of any size.
export default function Sidebar({ collapsed, onToggle, activeItem, onItemClick, onItemHover }) {
  const { logoUrl } = useOrgBranding()
  const { sees, role } = useRole()

  // A section this role cannot open is not in its menu. Only a couple are —
  // see lib/roles for why the list is deliberately short.
  const menu = useMemo(() => MENU
    .map((g) => (g.single
      ? (sees(g.key) ? g : null)
      : { ...g, children: g.children.filter((c) => sees(c.key)) }))
    .filter((g) => g && (g.single || g.children.length)), [sees, role])
  const [filter, setFilter] = useState('')

  // Every group open to begin with, and closing one leaves the others alone.
  //
  // This was an accordion — one `opened` key, so opening any group shut the one
  // before it and a person comparing two registers kept losing the menu they
  // had just used. On a portal whose whole point is that four separate areas
  // relate to each other, that is the wrong default. So the state tracks what
  // has been *collapsed* rather than what is open: an empty set means the whole
  // menu is showing, which is what someone landing here should see.
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())
  const toggleGroup = (key) => setCollapsedGroups((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const q = filter.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!q) return menu
    return menu
      .map((g) => (g.single
        ? (g.label.toLowerCase().includes(q) || (g.kw || '').includes(q) ? g : null)
        : { ...g, children: g.children.filter((c) => c.label.toLowerCase().includes(q) || (c.kw || '').includes(q)) }))
      .filter((g) => g && (g.single || g.children.length))
  }, [menu, q])

  const go = (key) => onItemClick(key)

  return (
    <div style={{ ...styles.sidebar, width: collapsed ? 62 : 258 }}>
      <style>{`
        .ox-nav { scrollbar-width: thin; scrollbar-color: #dbe1ea transparent; }
        .ox-nav::-webkit-scrollbar { width: 6px; }
        .ox-nav::-webkit-scrollbar-track { background: transparent; }
        .ox-nav::-webkit-scrollbar-thumb { background: #dbe1ea; border-radius: 999px; }
        .ox-nav::-webkit-scrollbar-thumb:hover { background: #b9c2cf; }
      `}</style>

      <div
        role="button" tabIndex={0}
        onClick={() => go('dashboard')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go('dashboard') }}
        onMouseEnter={() => onItemHover?.('dashboard')}
        title="Oxmaint AI"
        style={{ cursor: 'pointer', flexShrink: 0 }}>
        <OxmaintBrandCard collapsed={collapsed} logoUrl={logoUrl} />
      </div>

      {/* The real conflict here was never the vertical position — it was that
          the header's wordmark began at x=262 while this button reached x=271,
          so the two overlapped. The header now starts clear of it. */}
      <button onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} style={styles.edgeToggle}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {collapsed ? <path d="M5 12h14M13 6l6 6-6 6" /> : <path d="M19 12H5M11 18l-6-6 6-6" />}
        </svg>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 13px 10px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c8798" strokeWidth="2.2" strokeLinecap="round"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter menu" style={styles.filter} />
            {filter && (
              <button onClick={() => setFilter('')} title="Clear" style={styles.clear}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7c8798" strokeWidth="2.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="ox-nav" style={styles.nav}>
        {shown.map((group) => {
          const single = Boolean(group.single)
          // Open unless someone has closed it. A filter term forces every
          // group open so a match is never hidden behind a collapsed heading.
          const isOpen = !single && (collapsed || Boolean(q) || !collapsedGroups.has(group.key))
          const active = single
            ? activeItem === group.key
            : group.children.some((c) => c.key === activeItem)

          return (
            <div key={group.key} style={{ marginBottom: 2 }}>
              <div
                role="button" tabIndex={0}
                onClick={() => (single ? go(group.key) : toggleGroup(group.key))}
                onKeyDown={(e) => { if (e.key === 'Enter') (single ? go(group.key) : toggleGroup(group.key)) }}
                onMouseEnter={(e) => {
                  if (single) onItemHover?.(group.key)
                  else group.children.forEach((c) => onItemHover?.(c.key))
                  if (!active) e.currentTarget.style.background = '#f5f7fb'
                }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                title={group.label}
                style={{ ...styles.groupRow, ...(active ? styles.groupRowActive : {}), justifyContent: collapsed ? 'center' : 'flex-start' }}>
                <span style={{ ...styles.groupIcon, ...(active ? styles.groupIconActive : {}) }}>
                  {sectionIcon(group.icon || group.key, active ? ACCENT : '#64748b')}
                </span>
                {!collapsed && (
                  <>
                    <span style={{ ...styles.groupLabel, color: active ? ACCENT : '#4a5568' }}>{group.label}</span>
                    {!single && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={active ? ACCENT : '#7c8798'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .18s', flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </>
                )}
              </div>

              {!collapsed && isOpen && !single && (
                <div style={styles.submenu}>
                  {group.children.map((child) => {
                    const on = child.key === activeItem
                    return (
                      <div key={child.key}
                        role="button" tabIndex={0}
                        onClick={() => go(child.key)}
                        onKeyDown={(e) => { if (e.key === 'Enter') go(child.key) }}
                        onMouseEnter={(e) => { onItemHover?.(child.key); if (!on) e.currentTarget.style.background = '#f5f7fb' }}
                        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}
                        title={child.label}
                        style={{ ...styles.subItem, ...(on ? styles.subItemActive : {}) }}>
                        <span style={{ ...styles.dot, ...(on ? styles.dotActive : {}) }} />
                        <span style={{ ...styles.subLabel, ...(on ? { color: ACCENT, fontWeight: 600 } : {}) }}>{child.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {!shown.length && (
          <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: '#7c8798' }}>
            Nothing matches &ldquo;{filter}&rdquo;.
          </div>
        )}
      </nav>

      {!collapsed && (
        <div style={styles.footer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 4px', fontSize: 10.5, color: '#7c8798', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
            {role.short} · v1.4.2
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  sidebar: { position: 'fixed', top: 0, left: 0, height: '100vh', background: '#fff', borderRight: '1px solid #e4e9f0', boxShadow: '1px 0 3px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', transition: 'width 0.18s ease', zIndex: 200 },
  edgeToggle: { position: 'absolute', top: 18, right: -13, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#fff', borderStyle: 'solid', borderWidth: 1, borderColor: '#dbe1ea', boxShadow: '0 2px 6px rgba(15,23,42,0.10)', cursor: 'pointer', zIndex: 210, padding: 0 },
  filter: { width: '100%', boxSizing: 'border-box', padding: '8px 26px 8px 31px', fontSize: 12, borderStyle: 'solid', borderWidth: 1, borderColor: '#e4e9f0', borderRadius: 9, outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#f7f9fc' },
  clear: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  nav: { flex: 1, overflowY: 'auto', padding: '2px 9px 10px' },

  groupRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', borderRadius: 9, cursor: 'pointer', transition: 'background .12s', userSelect: 'none' },
  // No fill behind an active group. The icon tile carries the state, which is
  // how the automotive portal does it — a filled row plus a filled tile plus a
  // filled child underneath is three highlights competing in one column.
  groupRowActive: {},
  groupIcon: { width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .12s' },
  groupIconActive: { background: ACCENT_LIGHT },
  // 13px regular-weight in #4a5568: readable, and lighter than the near-black
  // semibold this had, which made every group shout.
  groupLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  submenu: { marginLeft: 22, paddingLeft: 8, paddingBottom: 4, borderLeft: `2px solid ${ACCENT_LIGHT}` },
  subItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer', transition: 'background .12s', userSelect: 'none' },
  subItemActive: { background: ACCENT_LIGHT },
  subLabel: { minWidth: 0, fontSize: 12, fontWeight: 500, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dot: { width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1', flexShrink: 0, transition: 'background .12s' },
  dotActive: { background: ACCENT },

  footer: { padding: '9px 13px 11px', borderTop: '1px solid #e4e9f0', flexShrink: 0 },
}
