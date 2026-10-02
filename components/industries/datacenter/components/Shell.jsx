'use client'

// The portal shell — sidebar, header, site context.
//
// In a component rather than the route's layout for the same reason as the
// Oxmaint portal: Next reads `export const metadata` only from server
// components, and the browser tab has to name this portal without changing the
// other one's.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Assistant from './Assistant'
import { SiteProvider } from '../lib/siteStore'
import { WorkOrderStoreProvider, InspectionStoreProvider, ChecklistStoreProvider, RiskStoreProvider, TeamStoreProvider, DocumentStoreProvider, AssetStoreProvider, CorrelationStoreProvider } from '../lib/store'
import { assetPath } from '@/lib/apiPath'

export default function DataCenterShell({ children }) {
  const params = useParams()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [assistant, setAssistant] = useState(false)

  const activeItem = params?.section || 'overview'
  const go = (key) => router.push(`/portal/datacenter/${key}`)
  const prefetch = (key) => { try { router.prefetch(`/portal/datacenter/${key}`) } catch {} }

  const width = collapsed ? 62 : 258

  return (
    <WorkOrderStoreProvider>
    <RiskStoreProvider>
    <TeamStoreProvider>
    <DocumentStoreProvider>
    <AssetStoreProvider>
    <CorrelationStoreProvider>
    <InspectionStoreProvider>
    <ChecklistStoreProvider>
    <SiteProvider>
      {/* box-sizing does not inherit and its default is content-box, so any
          element given width:100% *and* padding is that much wider than the
          box it sits in. That is what pushed the KPI grid past the window and
          made the page slide sideways — each card was its track plus 36px of
          padding. Scoped to this portal rather than set globally: the CMMS
          portal was built without it and compensates in places, and changing
          the rule under it would move layouts nobody asked to move. */}
      {/* No overflow rule here, deliberately. `overflow-x: hidden` was added
          alongside box-sizing as a belt-and-braces guard, and it silently broke
          the header: when one axis stops being `visible` the other computes to
          `auto`, which made this element a scroll container — and `position:
          sticky` inside one sticks to that box, not the viewport. The header
          scrolled away with the page.
          box-sizing was the actual fix for the overflow, and every screen
          measures scrollWidth equal to clientWidth without a clip to hide
          behind. */}
      {/* The page's own scrollbar is the browser's, and Chrome's default is a
          17px grey channel down the right edge — twice the weight of the thin
          one the sidebar already wears, and the only piece of chrome on the
          screen that does not belong to the product.
          On `html` rather than `.dc-app` because the document is what scrolls;
          a rule scoped to this element would skin a scroll container that does
          not exist. The style tag unmounts with the portal, so the console and
          the other portal keep whatever they had. */}
      <style>{`
        .dc-app, .dc-app *, .dc-app *::before, .dc-app *::after { box-sizing: border-box; }
        html { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        html::-webkit-scrollbar { width: 10px; height: 10px; }
        html::-webkit-scrollbar-track { background: transparent; }
        html::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; border: 3px solid #f8fafc; }
        html::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
      <div className="dc-app" style={styles.layout}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          activeItem={activeItem}
          onItemClick={go}
          onItemHover={prefetch}
        />
        <div style={{ ...styles.main, marginLeft: `${width}px` }}>
          <TopBar onOpenAssistant={() => setAssistant(true)} />
          <div style={styles.content}>{children}</div>
        </div>

        <Assistant open={assistant} onClose={() => setAssistant(false)} />

        {/* The launcher is hidden while the panel is open — two ways to open
            one thing, one of them behind it, is how a floating button ends up
            covering the input it opened. */}
        {!assistant && (
          <button onClick={() => setAssistant(true)} style={styles.launcher} title="Ask about this PoC">
            <img src={assetPath('/oxmaint/logo-white.png')} alt="" aria-hidden="true" style={{ height: 24, width: 'auto' }} />
          </button>
        )}
      </div>
    </SiteProvider>
    </ChecklistStoreProvider>
    </InspectionStoreProvider>
    </CorrelationStoreProvider>
    </AssetStoreProvider>
    </DocumentStoreProvider>
    </TeamStoreProvider>
    </RiskStoreProvider>
    </WorkOrderStoreProvider>
  )
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  main: { flex: 1, minWidth: 0, transition: 'margin-left 0.2s ease' },
  content: { padding: '22px 24px 40px' },
  launcher: {
    position: 'fixed', right: 20, bottom: 20, zIndex: 390,
    width: 52, height: 52, borderRadius: '50%', border: 'none',
    background: '#15227a', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 22px rgba(21,34,122,0.35)',
  },
}
