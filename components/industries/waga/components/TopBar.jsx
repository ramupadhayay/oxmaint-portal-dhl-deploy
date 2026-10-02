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
// pick McKean on the permit register, walk to the calendar, and the filter
// is still on. A picker that resets between pages teaches an audience not to trust it.

import { useEffect, useState } from 'react'
import { useSite } from '../lib/siteStore'
import { apiUrl } from '@/lib/apiPath'
import { assetPath } from '@/lib/apiPath'

export default function TopBar() {
  const [isFullscreen, setFullscreen] = useState(false)

  // Who is signed in — shown as the profile at the right of the header.
  const [me, setMe] = useState(null)
  useEffect(() => {
    let live = true
    fetch(apiUrl('/api/portal/waga/me')).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setMe(d) }).catch(() => {})
    return () => { live = false }
  }, [])
  const initials = (n = '') => n.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

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

  // Signs out of the WAGA portal. The route clears the client's cookie and says
  // where to go next — the portal's own sign-in for a client, the console for an
  // admin who was only visiting.
  const exit = async () => {
    try {
      const res = await fetch(apiUrl('/api/portal/waga/logout'), { method: 'POST' })
      const data = await res.json().catch(() => ({ redirectTo: '/portal/waga/login' }))
      window.location.href = data.redirectTo || '/portal/waga/login'
    } catch {
      window.location.href = '/portal/waga/login'
    }
  }

  return (
    <div style={styles.bar}>
      {/* The client's own wordmark, and nothing else on the left. This portal is
          handed to WAGA Energy as theirs, so their mark is what belongs in the
          most permanent strip on the screen — and the lockup carries its own
          name, so a text label beside it would only say the same thing twice.
          The section name and the programme line used to sit here too. Both
          were already on the page: the section is the 30px heading directly
          below, and the programme is its subtitle. A header that repeats the
          two lines under it is spending the most permanent strip on the screen
          saying what the page already says. */}
      <img src={assetPath('/waga/waga-energy.png')} alt="WAGA Energy" style={styles.brand} />

      <div style={{ flex: '1 1 auto' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* "Illustrative" is the workbooks' own word for this data, and the PoC
            has not started. Saying so on every screen is more honest than a
            green "live" dot over sample rows. */}
        <span style={styles.pill}>
          <span style={styles.pillDot} />
          Illustrative PoC data
        </span>

        <ScopePicker />

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

        {me && (
          <span style={styles.profile} title={`${me.name} · ${me.email}`}>
            <span style={styles.avatar}>{initials(me.name)}</span>
            <span style={styles.profileText}>
              <span style={styles.profileName}>{me.name || me.email}</span>
              <span style={styles.profileRole}>{me.isAdmin ? 'Administrator' : (me.department || 'Member')}</span>
            </span>
          </span>
        )}

        <button onClick={exit} title="Sign out" style={styles.exit}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * The scope picker — country, then state or region, then site.
 *
 * One control rather than three cascading ones, because the header is 64px and
 * must not wrap: it already carries a wordmark, a data pill, two icon buttons
 * and a profile chip. A grouped select gives the whole hierarchy in the space a
 * single select was already using, and every level is itself selectable — so
 * "USA" filters the portal to that country the same way a site filters it to
 * one plant.
 *
 * Every country gets its own selectable row, even when the dataset has one. With
 * a single-country trial that row does select the same two sites "All trial
 * sites" does — but the redundancy is a fact about the data, not a flaw in the
 * control, and hiding the level would leave a reader unable to see that the
 * portal has it. Load a workbook with a French site and the same row starts
 * meaning something without a line of this file changing.
 */
function ScopePicker() {
  const { level, countryKey, stateKey, siteId, setScope, countries, sites } = useSite()

  const value = level === 'site' ? `site:${siteId}`
    : level === 'state' ? `state:${countryKey}|${stateKey}`
      : level === 'country' ? `country:${countryKey}`
        : 'all'

  const onChange = (raw) => {
    if (raw === 'all') return setScope({})
    const [kind, rest] = raw.split(/:(.*)/s)
    if (kind === 'country') return setScope({ countryKey: rest })
    if (kind === 'state') {
      const [c, st] = rest.split('|')
      return setScope({ countryKey: c, stateKey: st })
    }
    const site = sites.find((s) => s.siteId === rest)
    return setScope(site
      ? { countryKey: site.country || '', stateKey: site.state || '', siteId: rest }
      : {})
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.select}
      title="Filter every screen by country, state or site"
    >
      <option value="all">All trial sites ({sites.length})</option>

      {countries.map((c) => (
        <optgroup key={c.key || 'no-country'} label={c.label}>
          <option value={`country:${c.key}`}>
            {c.label} — all sites ({c.siteCount})
          </option>
          {c.states.map((st) => [
            // A state row is worth offering only where it groups something: with
            // one site under it, selecting the state and selecting the site are
            // the same filter written two ways.
            st.siteCount > 1 ? (
              <option key={`st-${st.key}`} value={`state:${c.key}|${st.key}`}>
                {st.label} — all sites ({st.siteCount})
              </option>
            ) : null,
            ...st.sites.map((s) => (
              <option key={s.siteId} value={`site:${s.siteId}`}>
                {st.label} · {s.code} — {s.siteName}
              </option>
            )),
          ])}
        </optgroup>
      ))}
    </select>
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
  brand: { height: 30, width: 'auto', objectFit: 'contain', flexShrink: 0, display: 'block' },
  profile: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px', background: '#fff', border: '1px solid #e4e9f0', borderRadius: 999, flexShrink: 0 },
  avatar: { width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#1f2d92,#15227a)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  profileText: { display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 },
  profileName: { fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 },
  profileRole: { fontSize: 10, fontWeight: 600, color: '#7c8798' },
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
