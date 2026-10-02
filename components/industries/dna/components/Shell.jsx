'use client'

// The portal shell — sidebar, header, department context.
//
// In a component rather than the route's layout for the same reason as the other
// portals: Next reads `export const metadata` only from server components, and
// the browser tab has to name this portal without changing theirs.
//
// Read-only, like the WAGA portal and unlike the CMMS. Everything shown is the
// supplied workbook or arithmetic over it, and the workbook has no completion
// history to write against — a tick box that saved a record would be inventing
// the one thing the covering document says to treat as sample data.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { DeptProvider } from '../lib/deptStore'
import { AssetStoreProvider, WorkOrderStoreProvider, MemberStoreProvider, PurchaseOrderStoreProvider } from '../lib/store'

export default function DnaShell({ children }) {
  const params = useParams()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const activeItem = params?.section || 'overview'
  const go = (key) => router.push(`/portal/dna/${key}`)
  const prefetch = (key) => { try { router.prefetch(`/portal/dna/${key}`) } catch {} }

  const width = collapsed ? 62 : 258

  return (
    <AssetStoreProvider>
    <WorkOrderStoreProvider>
    <MemberStoreProvider>
    <PurchaseOrderStoreProvider>
    <DeptProvider>
      {/* box-sizing scoped to this portal, for the reason the datacenter shell
          records: it does not inherit, its default is content-box, and any
          element given width:100% plus padding is that much wider than its box —
          which is what pushes a KPI grid past the window and makes the page
          slide sideways. Scoped rather than global because the CMMS portal was
          built without it and compensates in places. */}
      <style>{`
        .dna-app, .dna-app *, .dna-app *::before, .dna-app *::after { box-sizing: border-box; }
        html { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        html::-webkit-scrollbar { width: 10px; height: 10px; }
        html::-webkit-scrollbar-track { background: transparent; }
        html::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; border: 3px solid #f8fafc; }
        html::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <div className="dna-app" style={styles.layout}>
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
      </div>
    </DeptProvider>
    </PurchaseOrderStoreProvider>
    </MemberStoreProvider>
    </WorkOrderStoreProvider>
    </AssetStoreProvider>
  )
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  main: { flex: 1, minWidth: 0, transition: 'margin-left 0.2s ease' },
  content: { padding: '22px 24px 40px' },
}
