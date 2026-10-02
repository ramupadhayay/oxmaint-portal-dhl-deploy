'use client'

// Which modules this organisation has switched on.
//
// The Settings screen has had module toggles since the start and they did
// nothing — they set local state that vanished on navigation. A switch that
// does not switch anything is worse than no switch: it is the one control an
// audience is guaranteed to try.
//
// Hidden groups are stored, not derived, so the choice survives a reload and is
// the same for the next person. What is stored is the *hidden* list rather than
// the visible one, so a module added to the product later is on by default
// instead of silently missing for everyone who saved a setting before it
// existed.

import { createContext, useContext, useMemo } from 'react'
import { useStore } from './store'
import { MENU } from './nav'

const RECORD_ID = 'org_module_visibility'

const VisibilityContext = createContext(null)

export function VisibilityProvider({ children }) {
  const store = useStore()
  const row = store?.records?.visibility?.[0]

  const value = useMemo(() => {
    const hidden = Array.isArray(row?.hidden) ? row.hidden : []
    const hiddenSet = new Set(hidden)

    return {
      hidden,
      isHidden: (key) => hiddenSet.has(key),
      // The menu the sidebar and the command palette both read.
      menu: MENU.filter((g) => !hiddenSet.has(g.key)),
      toggle: (key) => {
        const next = hiddenSet.has(key) ? hidden.filter((k) => k !== key) : [...hidden, key]
        return store?.update('visibility', RECORD_ID, { hidden: next })
      },
      showAll: () => store?.update('visibility', RECORD_ID, { hidden: [] }),
    }
  }, [row, store])

  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>
}

export function useVisibility() {
  const ctx = useContext(VisibilityContext)
  // A sensible fallback so a component rendered outside the provider still
  // shows the whole menu rather than none of it.
  return ctx || { hidden: [], isHidden: () => false, menu: MENU, toggle: () => {}, showAll: () => {} }
}
