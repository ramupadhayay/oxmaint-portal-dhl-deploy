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
// pick the loom shed on the asset register, walk to work orders, and the
// filter is still on. A picker that resets between pages teaches an audience not to trust it.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDept } from '../lib/deptStore'
import { SECTIONS } from '../lib/nav'
import { assets, workOrders, pmSchedules, parts } from '../lib/data'
import { apiUrl } from '@/lib/apiPath'

// Everything the palette can jump to, built once. Screens first because they are
// what a demo navigates between; records after, because that is what somebody
// reaches for when they already know the id they want.
const TARGETS = [
  ...SECTIONS.map((s) => ({ kind: 'Screen', id: s.label, sub: s.group, kw: s.kw, href: `/portal/dna/${s.key}` })),
  ...assets.map((a) => ({ kind: 'Asset', id: a.assetId, sub: `${a.name} - ${a.manufacturer} ${a.model}`, kw: `${a.name} ${a.manufacturer} ${a.model} ${a.serial} ${a.category}`.toLowerCase(), href: `/portal/dna/assets/${a.assetId}` })),
  ...workOrders.map((w) => ({ kind: 'Work order', id: w.woNo, sub: w.title, kw: `${w.title} ${w.assetId} ${w.assignedTo} ${w.type}`.toLowerCase(), href: `/portal/dna/work-orders/${w.woNo}` })),
  ...pmSchedules.map((p) => ({ kind: 'PM', id: p.pmId, sub: p.task, kw: `${p.task} ${p.assetId} ${p.team} ${p.frequency}`.toLowerCase(), href: `/portal/dna/pm-schedules/${p.pmId}` })),
  ...parts.map((p) => ({ kind: 'Part', id: p.partNo, sub: `${p.name} - ${p.supplier}`, kw: `${p.name} ${p.supplier} ${p.category}`.toLowerCase(), href: '/portal/dna/parts' })),
]

export default function TopBar() {
  const router = useRouter()
  const { dept, setDept, departments } = useDept()
  const [isFullscreen, setFullscreen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Ctrl+K anywhere in the portal. Escape closes it, because a search box you
  // cannot dismiss without reaching for the mouse is worse than no shortcut.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      if (e.key === 'Escape') setPaletteOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TARGETS.filter((t) => t.kind === 'Screen')
    return TARGETS
      .filter((t) => t.id.toLowerCase().includes(q) || (t.sub || '').toLowerCase().includes(q) || (t.kw || '').includes(q))
      .slice(0, 40)
  }, [query])

  const jump = (href) => { setPaletteOpen(false); setQuery(''); router.push(href) }

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
    <>
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
        {/* "Illustrative" is the workbooks' own word for this data, and the PoC
            has not started. Saying so on every screen is more honest than a
            green "live" dot over sample rows. */}
        <span style={styles.pill}>
          <span style={styles.pillDot} />
          Sample demo data
        </span>

        <button onClick={() => setPaletteOpen(true)} style={styles.search} title="Search (Ctrl+K)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c8798" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <span style={{ color: '#94a3b8' }}>Search</span>
          <kbd style={styles.kbd}>Ctrl K</kbd>
        </button>

        <select value={dept} onChange={(e) => setDept(e.target.value)} style={styles.select} title="Filter every screen by department">
          <option value="all">All departments ({departments.length})</option>
          {departments.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
        </select>

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

    {paletteOpen && (
      <>
        <div onClick={() => setPaletteOpen(false)} style={styles.scrim} />
        <div style={styles.palette}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a screen, asset, work order, schedule or part…"
            style={styles.paletteInput}
          />
          <div style={styles.paletteList}>
            {results.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => jump(r.href)}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f7fb' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                style={styles.paletteRow}
              >
                <span style={styles.paletteKind}>{r.kind}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={styles.paletteId}>{r.id}</span>
                  {r.sub ? <span style={styles.paletteSub}>{r.sub}</span> : null}
                </span>
              </button>
            ))}
            {!results.length && (
              <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: '#94a3b8' }}>
                Nothing matches &ldquo;{query}&rdquo;.
              </div>
            )}
          </div>
        </div>
      </>
    )}
    </>
  )
}

const styles = {
  search: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
    border: '1px solid #e4e9f0', borderRadius: 9, background: '#f7f9fc',
    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  kbd: {
    fontSize: 9.5, fontWeight: 700, color: '#7c8798', background: '#fff',
    border: '1px solid #e4e9f0', borderRadius: 5, padding: '2px 5px', fontFamily: 'inherit',
  },
  scrim: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.28)', zIndex: 400 },
  palette: {
    position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)',
    width: 'min(620px, calc(100vw - 40px))', zIndex: 401,
    background: '#fff', border: '1px solid #e4e9f0', borderRadius: 14,
    boxShadow: '0 24px 60px rgba(15,23,42,0.22)', overflow: 'hidden',
  },
  paletteInput: {
    width: '100%', boxSizing: 'border-box', padding: '15px 18px', fontSize: 14,
    border: 'none', borderBottom: '1px solid #eef1f6', outline: 'none',
    fontFamily: 'inherit', color: '#0f172a',
  },
  paletteList: { maxHeight: 380, overflowY: 'auto', padding: 6 },
  paletteRow: {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
    padding: '9px 12px', border: 'none', background: 'none', borderRadius: 8,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
  },
  paletteKind: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
    color: '#15227a', background: '#eef2ff', border: '1px solid #c7d2fe',
    borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 74, textAlign: 'center',
  },
  paletteId: { fontSize: 12.5, fontWeight: 600, color: '#0f172a', display: 'block' },
  paletteSub: { fontSize: 11, color: '#64748b', display: 'block', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
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
  exit: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#ef4444', border: 'none', borderRadius: 9, height: 32, width: 34,
    cursor: 'pointer', flexShrink: 0,
  },
}
