'use client'

// The same sidebar as the other two portals': brand card, menu filter, grouped
// nav with an icon tile carrying the active state, collapsed rail.
//
// It is a separate file rather than a shared component because the Oxmaint one
// is wired to that portal's branding store and module-visibility context, and
// this portal has neither — a trial deliverable has a fixed menu by definition.
// The markup and the palette are deliberately identical so the three portals do
// not drift apart visually.

import { useMemo, useState } from 'react'
import { sectionIcon } from '../lib/nav'
import { MENU } from '../lib/nav'
import { ORG } from '../lib/data'
import { useSite } from '../lib/siteStore'
import { assetPath } from '@/lib/apiPath'

const ACCENT = '#15227a'
const ACCENT_LIGHT = '#e8ecff'

export default function Sidebar({ collapsed, onToggle, activeItem, onItemClick, onItemHover }) {
  const { sites } = useSite()
  const [filter, setFilter] = useState('')

  // Every group starts open, and closing one is the deliberate act. This was an
  // accordion that kept exactly one group open — whichever held the current
  // screen — so half the portal sat behind a shut chevron, and moving between
  // Compliance and Safety cost a click before it cost a click.
  const [closed, setClosed] = useState(() => new Set())
  const toggleGroup = (key) => setClosed((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const q = filter.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!q) return MENU
    return MENU
      .map((g) => (g.single
        ? (g.label.toLowerCase().includes(q) || (g.kw || '').includes(q) ? g : null)
        : { ...g, children: g.children.filter((c) => c.label.toLowerCase().includes(q) || (c.kw || '').includes(q)) }))
      .filter((g) => g && (g.single || g.children.length))
  }, [q])

  const go = (key) => onItemClick(key)

  return (
    <div style={{ ...styles.sidebar, width: collapsed ? 62 : 258 }}>
      <style>{`
        .wg-nav { scrollbar-width: thin; scrollbar-color: #dbe1ea transparent; }
        .wg-nav::-webkit-scrollbar { width: 6px; }
        .wg-nav::-webkit-scrollbar-track { background: transparent; }
        .wg-nav::-webkit-scrollbar-thumb { background: #dbe1ea; border-radius: 999px; }
        .wg-nav::-webkit-scrollbar-thumb:hover { background: #b9c2cf; }
      `}</style>

      <div
        role="button" tabIndex={0}
        onClick={() => go('overview')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go('overview') }}
        onMouseEnter={() => onItemHover?.('overview')}
        title={`${ORG.name} — ${ORG.programme}`}
        style={{ cursor: 'pointer', flexShrink: 0, padding: collapsed ? '12px 0 8px' : '14px 14px 10px' }}>
        {/* The product first, the customer under it. This portal is an Oxmaint
            deliverable, and a brand card that shows
            only the customer leaves the reader unable to say whose software
            they are looking at — which is the one thing a demo has to answer. */}
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img src={assetPath('/waga/ifactory-logo.png')} alt="iFactory AI" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={styles.brandCard}>
            <img src={assetPath('/waga/ifactory-logo.png')} alt="" aria-hidden="true" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
            <div style={{ minWidth: 0, textAlign: 'center' }}>
              <div style={styles.brandName}>iFactory <span style={{ color: '#f5b700' }}>AI</span></div>
              <div style={styles.brandRule} />
              <div style={styles.brandCustomer}>{ORG.name}</div>
              <div style={styles.brandSub}>{ORG.programme}</div>
            </div>
          </div>
        )}
      </div>

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

      <nav className="wg-nav" style={styles.nav}>
        {shown.map((group) => {
          const single = Boolean(group.single)
          const isOpen = !single && (collapsed || Boolean(q) || !closed.has(group.key))
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
                style={{ ...styles.groupRow, justifyContent: collapsed ? 'center' : 'flex-start' }}>
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
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
            {/* The live count, not the workbook's. A site added in the portal
                scopes every screen, so a footer that keeps saying two would
                disagree with the picker directly above it. */}
            Compliance &amp; EHS Trial · {sites.length} site{sites.length === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  sidebar: { position: 'fixed', top: 0, left: 0, height: '100vh', background: '#fff', borderRight: '1px solid #e4e9f0', boxShadow: '1px 0 3px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', transition: 'width 0.18s ease', zIndex: 200 },
  brandCard: { border: '1px solid #e8ecf1', borderRadius: 14, background: '#fff', padding: '13px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' },
  brandName: { fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' },
  brandRule: { height: 1, background: '#eef1f6', margin: '7px 0 6px' },
  brandCustomer: { fontSize: 14.5, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' },
  brandSub: { fontSize: 10.5, fontWeight: 600, color: '#7c8798', marginTop: 2 },
  edgeToggle: { position: 'absolute', top: 18, right: -13, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#fff', border: '1px solid #dbe1ea', boxShadow: '0 2px 6px rgba(15,23,42,0.10)', cursor: 'pointer', zIndex: 210, padding: 0 },
  filter: { width: '100%', boxSizing: 'border-box', padding: '8px 26px 8px 31px', fontSize: 12, border: '1px solid #e4e9f0', borderRadius: 9, outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#f7f9fc' },
  clear: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  nav: { flex: 1, overflowY: 'auto', padding: '2px 9px 10px' },

  groupRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', borderRadius: 9, cursor: 'pointer', transition: 'background .12s', userSelect: 'none' },
  groupIcon: { width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .12s' },
  groupIconActive: { background: ACCENT_LIGHT },
  groupLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  submenu: { marginLeft: 22, paddingLeft: 8, paddingBottom: 4, borderLeft: `2px solid ${ACCENT_LIGHT}` },
  subItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer', transition: 'background .12s', userSelect: 'none' },
  subItemActive: { background: ACCENT_LIGHT },
  subLabel: { minWidth: 0, fontSize: 12, fontWeight: 500, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dot: { width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1', flexShrink: 0, transition: 'background .12s' },
  dotActive: { background: ACCENT },

  footer: { padding: '9px 13px 11px', borderTop: '1px solid #e4e9f0', flexShrink: 0 },
}
