'use client'

// The portal shell — sidebar, header, the record store and the save toast.
//
// This lives in a component rather than in the route's layout so that the
// layout can stay a server component. Next only reads `export const metadata`
// from server components, and the browser tab has to say Oxmaint AI on these
// routes without changing it for the other portals.
//
// Two providers the CMMS portal wraps are absent here. The visibility provider
// switches modules off, which over this menu would leave less menu than reason
// for having one. The site provider scopes screens to one plant of several;
// this is one facility.
//
// The assistant answers off the same records the screens render, so a count it
// gives is the count on the page rather than a second opinion. That is also the
// answer to the worry that held it back: a compliance question deserves a right
// answer, and reading the array is how it gets one. It matches intents by
// keyword and says what it cannot answer rather than guessing around it.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import SaveToast from './SaveToast'
import SynapseChat from './SynapseChat'
import { RecordStoreProvider } from '../lib/store'
import { RoleProvider } from '../lib/roles'

export default function HepaShell({ children }) {
  const params = useParams()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [assistant, setAssistant] = useState(false)

  const activeItem = params?.section || 'overview'
  const setActiveItem = (key) => router.push(`/portal/hepa/${key}`)
  const prefetchItem = (key) => { try { router.prefetch(`/portal/hepa/${key}`) } catch {} }

  const sidebarWidth = sidebarCollapsed ? 62 : 258

  return (
    <RoleProvider>
    <RecordStoreProvider>
      {/* Printing, once, for the whole portal.

          The screens used to do this themselves by hiding everything with
          `visibility: hidden` and re-showing one container. That does not work:
          `visibility: hidden` hides an element and *keeps its space*, so the
          sidebar and the shell still occupied 1200px of the sheet and the
          schedule printed on page two behind a blank page one. Measured with
          print media emulated — thirty-four elements hidden and still taking
          room.

          `display: none` on the chrome is the fix, and doing it here means a
          new screen prints correctly without having to remember any of this.
          A screen hides its own controls with `.ox-noprint`. */}
      <style>{`
        /* box-sizing does not inherit and defaults to content-box, so anything
           given a width AND padding comes out that much wider than its box.
           The metric cards are 1fr grid tracks with 28px of padding, so a row
           of four ran past the content area and the last card was cut off at
           the window edge.

           The FSM portal hit this and fixed it exactly here, scoped to its own
           root. Importing its cards without importing the rule they were built
           under is what put the bug back. Scoped rather than global for its
           reason too: the CMMS portal was built without this and compensates in
           places, and changing the rule under it would move layouts nobody
           asked to move.

           No overflow-x guard alongside it, deliberately: when one axis stops
           being visible the other computes to auto, which makes this a scroll
           container — and a sticky element inside one sticks to that box rather
           than the viewport, which is how the header stopped sticking in the
           sibling portal. box-sizing is the actual fix. */
        .hepa-app, .hepa-app *, .hepa-app *::before, .hepa-app *::after { box-sizing: border-box; }

        html { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        html::-webkit-scrollbar { width: 10px; height: 10px; }
        html::-webkit-scrollbar-track { background: transparent; }
        html::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; border: 3px solid #f8fafc; }
        html::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        @media print {
          .hepa-chrome { display: none !important; }
          .ox-noprint { display: none !important; }
          .hepa-main { margin-left: 0 !important; }
          .hepa-content { padding: 0 !important; }
          .ox-printonly { display: block !important; }
          @page { margin: 14mm; }
        }
        .ox-printonly { display: none; }
      `}</style>

      <div className="hepa-app" style={styles.layout}>
        <div className="hepa-chrome">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeItem={activeItem}
            onItemClick={setActiveItem}
            onItemHover={prefetchItem}
          />
        </div>
        {/* No overflow rule on this wrapper, deliberately. An `overflow-x`
            guard here is what made the sibling portal's header stop sticking:
            it turns the element into a scroll container, and `position: sticky`
            resolves against the nearest one. */}
        <div className="hepa-main" style={{ ...styles.main, marginLeft: `${sidebarWidth}px` }}>
          {/* The class goes on the header itself, not on a wrapper — see the
              note on TopBar. A wrapper here is what broke the sticky. */}
          <TopBar className="hepa-chrome" onOpenAssistant={() => setAssistant(true)} />
          <div className="hepa-content" style={styles.content}>{children}</div>
        </div>
        <div className="hepa-chrome">
          <SaveToast />
          {/* Both callbacks, not just onClose. The header opens it and the
              floating launcher toggles it, and a controlled component that only
              reports one direction leaves the launcher dead. */}
          <SynapseChat
            open={assistant}
            onOpen={() => setAssistant(true)}
            onClose={() => setAssistant(false)}
          />
        </div>
      </div>
    </RecordStoreProvider>
    </RoleProvider>
  )
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  main: { flex: 1, minWidth: 0, transition: 'margin-left 0.2s ease' },
  // The header is `position: sticky`, so it is in the flow and already occupies
  // its own 54px. Padding the content to clear it as well — which is what a
  // fixed header would need — put an empty band above every page.
  content: { padding: '22px 24px 40px' },
}
