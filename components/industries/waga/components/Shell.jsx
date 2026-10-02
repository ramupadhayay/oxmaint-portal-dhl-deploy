'use client'

// The portal shell — sidebar, header, site context.
//
// In a component rather than the route's layout for the same reason as the
// other two portals: Next reads `export const metadata` only from server
// components, and the browser tab has to name this portal without changing
// theirs.
//
// The workbook is read-only reference and stays that way — nothing here edits a
// permit or rewrites a requirement. What the store adds is the layer above it:
// the transactions the trial was sold on. Completing a generated filing is not
// inventing source data, it is recording that the compliance team did the thing
// the source says is required — the distinction the workbook's own README draws
// between the recurring rule and the completion against it. So the store lives
// here now, wrapping the portal, and the toast it raises renders at the shell.

import { useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import HelpButton from './HelpButton'
import { SiteProvider } from '../lib/siteStore'
import { RecordStoreProvider, useStore } from '../lib/store'

export default function WagaShell({ children }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  // The sign-in page sits under this layout only because its URL does. It is a
  // full-screen composition of its own and must not wear the portal's sidebar
  // and header, so it renders bare — the standalone door proxy.js sends people
  // to. Every hook above is called first, so the early return breaks no rule.
  if (pathname === '/portal/waga/login') return children

  const activeItem = params?.section || 'overview'
  const go = (key) => router.push(`/portal/waga/${key}`)
  const prefetch = (key) => { try { router.prefetch(`/portal/waga/${key}`) } catch {} }

  const width = collapsed ? 62 : 258

  // The record store is the OUTER provider. The scope filter grew a country
  // level above sites, and a site added in the portal has to appear in that
  // filter — so SiteProvider reads the store, and a provider cannot read a
  // context declared inside it. Nothing in the store depends on the site scope,
  // so the swap costs nothing.
  return (
    <RecordStoreProvider>
    <SiteProvider>
      {/* box-sizing scoped to this portal, for the reason the datacenter shell
          records: it does not inherit, its default is content-box, and any
          element given width:100% plus padding is that much wider than its
          box — which is what pushes a KPI grid past the window and makes the
          page slide sideways. Scoped rather than global because the CMMS
          portal was built without it and compensates in places. */}
      <style>{`
        .wg-app, .wg-app *, .wg-app *::before, .wg-app *::after { box-sizing: border-box; }
        html { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        html::-webkit-scrollbar { width: 10px; height: 10px; }
        html::-webkit-scrollbar-track { background: transparent; }
        html::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; border: 3px solid #f8fafc; }
        html::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <div className="wg-app" style={styles.layout}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          activeItem={activeItem}
          onItemClick={go}
          onItemHover={prefetch}
        />
        <div style={{ ...styles.main, marginLeft: `${width}px` }}>
          <TopBar />
          <div style={styles.content}>{children}</div>
        </div>
        {/* Mounted at the shell rather than on each screen, so every section —
            and every record route under one — carries the same help corner
            without fourteen pages having to remember to. */}
        <HelpButton section={activeItem} />
        <Toast />
      </div>
    </SiteProvider>
    </RecordStoreProvider>
  )
}

/**
 * The store's one transient message, bottom-right, out of the way of the list —
 * and now stacked above the help button, which is permanent and holds that
 * corner. A toast that lands on top of it hides the control a confused user is
 * reaching for at exactly the moment something has just happened.
 */
function Toast() {
  const { toast } = useStore()
  if (!toast) return null
  const tone = toast.tone === 'error'
    ? { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' }
    : { bg: '#ecfdf5', bd: '#a7f3d0', fg: '#047857' }
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 76, zIndex: 4000,
      padding: '11px 16px', borderRadius: 10, background: tone.bg, color: tone.fg,
      fontSize: 13, fontWeight: 600, maxWidth: 340, lineHeight: 1.45,
      borderStyle: 'solid', borderWidth: 1, borderColor: tone.bd,
      boxShadow: '0 6px 20px rgba(15,23,42,.12)',
    }}>
      {toast.message}
    </div>
  )
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  main: { flex: 1, minWidth: 0, transition: 'margin-left 0.2s ease' },
  content: { padding: '22px 24px 40px' },
}
