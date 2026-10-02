'use client'

// The portal shell — sidebar, header, providers and the two floating pieces.
//
// This lives in a component rather than in the route's layout so that the
// layout can stay a server component. Next only reads `export const metadata`
// from server components, and the browser tab has to say Oxmaint AI on these
// routes without changing it for the other twenty portals.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import SynapseChat from './SynapseChat'
import { Toaster } from '../ui/sonner'
import { SiteProvider } from '../lib/siteStore'
import { RecordStoreProvider } from '../lib/store'
import { VisibilityProvider } from '../lib/visibility'

export default function OxmaintShell({ children }) {
  const params = useParams()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Below desktop width the sidebar is a drawer, closed until asked for.
  const [menuOpen, setMenuOpen] = useState(false)

  const activeItem = params?.section || 'dashboard'
  const setActiveItem = (key) => router.push(`/portal/oxmaint/${key}`)
  const prefetchItem = (key) => { try { router.prefetch(`/portal/oxmaint/${key}`) } catch {} }

  // The iFactory shell reported the first view of the portal to /api/track, a
  // platform-wide analytics endpoint. This build has no such endpoint, so the
  // call is removed rather than left firing at a 404 on every load.

  // The product scales its whole interface with `html { font-size: 90% }`, which
  // is where its density comes from. `rem` only ever resolves against the root
  // element, so this cannot be scoped to a container — the class goes on <html>
  // while this portal is mounted and comes off on the way out, leaving the other
  // five portals at browser-default sizing.
  useEffect(() => {
    document.documentElement.classList.add('ox-ui')
    return () => document.documentElement.classList.remove('ox-ui')
  }, [])

  // A drawer that stays open over the page you just picked is a second tap
  // nobody should need.
  useEffect(() => { setMenuOpen(false) }, [activeItem])

  const sidebarWidth = sidebarCollapsed ? 58 : 244

  return (
    <RecordStoreProvider>
      <VisibilityProvider>
        <SiteProvider>
        {/* Narrow screens. The shell is styled inline, so the phone and tablet
            layout overrides those styles here rather than rewriting them —
            desktop stays exactly as it was. Below 1024px the sidebar becomes a
            drawer and the header sheds what a phone cannot fit; below 640px the
            site picker and the second sign-out button go too (sign out stays in
            the profile menu). A technician on the ramp opens this on a phone. */}
        <style>{`
          .ox-backdrop, .ox-hamburger { display: none; }
          @media (max-width: 1023px) {
            .ox-main { margin-left: 0 !important; }
            .ox-content { padding: 16px 12px 32px !important; }
            .ox-sidebar { width: 258px !important; transform: translateX(-100%); transition: transform .2s ease !important; }
            .ox-sidebar[data-open="true"] { transform: none; box-shadow: 0 10px 40px rgba(15,23,42,.25) !important; }
            .ox-edge-toggle { display: none !important; }
            .ox-backdrop { display: block; position: fixed; inset: 0; background: rgba(15,23,42,.35); z-index: 190; }
            .ox-hamburger { display: flex !important; }
            .ox-topbar { padding: 0 10px !important; gap: 6px !important; }
            .ox-hide-md { display: none !important; }
          }
          @media (max-width: 639px) {
            .ox-hide-sm { display: none !important; }
          }
        `}</style>
        <div style={styles.layout}>
          {menuOpen && <div className="ox-backdrop" onClick={() => setMenuOpen(false)} />}
          <Sidebar
            mobileOpen={menuOpen}
            collapsed={sidebarCollapsed && !menuOpen}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeItem={activeItem}
            onItemClick={setActiveItem}
            onItemHover={prefetchItem}
          />
          <div className="ox-main" style={{ ...styles.main, marginLeft: `${sidebarWidth}px` }}>
            <TopBar onMenu={() => setMenuOpen(true)} />
            <div className="ox-content" style={styles.content}>{children}</div>
          </div>
          <SynapseChat />
        </div>
        {/* The product's notification line, with its own props verbatim: it
            arrives at the TOP CENTRE of the screen, coloured by kind, and can be
            dismissed. Everything this portal saves reports through it.
            SaveToast, the dark pill this portal used to raise in the opposite
            corner, is gone rather than left alongside — the same save was being
            announced twice, in two different places, in two different styles. */}
        <Toaster position="top-center" richColors closeButton theme="light" />
        </SiteProvider>
      </VisibilityProvider>
    </RecordStoreProvider>
  )
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  main: { flex: 1, minWidth: 0, transition: 'margin-left 0.2s ease' },
  content: { padding: '22px 24px 40px' },
}
