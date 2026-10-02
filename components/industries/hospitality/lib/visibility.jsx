'use client'

// Which modules this property has switched on.
//
// The same mechanism the CMMS portal has, and it is here for a reason this
// portal now has of its own: it carries two estates. A hotel's engineering
// team has no use for reserve fund forecasting, and a condo board has no use
// for suite rotation or guest requests. Rather than build two portals or show
// everybody everything, the groups that do not apply are switched off — and the
// menu is then honestly short instead of half irrelevant.
//
// Hidden groups are stored rather than held in state, so the choice survives a
// reload and is the same for the next person to open it. What is stored is the
// *hidden* list rather than the visible one, so a module added later is on by
// default instead of silently missing for anyone who saved a setting before it
// existed.

import { createContext, useContext, useMemo } from 'react'
import { useStore } from './store'
import { MENU } from './nav'

const RECORD_ID = 'property_module_visibility'

// Two groups can never be hidden. Overview is where a hidden-everything menu
// would otherwise leave somebody stranded, and Settings is the only way back —
// switching off the screen that holds the switches is a door that locks behind
// you.
export const ALWAYS_ON = new Set(['overview', 'org-grp'])

const VisibilityContext = createContext(null)

export function VisibilityProvider({ children }) {
  const store = useStore()
  const row = store?.records?.hosp_visibility?.[0]

  const value = useMemo(() => {
    const hidden = Array.isArray(row?.hidden) ? row.hidden : []
    const hiddenSet = new Set(hidden.filter((k) => !ALWAYS_ON.has(k)))

    return {
      hidden: [...hiddenSet],
      isHidden: (key) => hiddenSet.has(key),
      canHide: (key) => !ALWAYS_ON.has(key),
      // The menu the sidebar and the command palette both read.
      menu: MENU.filter((g) => !hiddenSet.has(g.key)),
      toggle: (key) => {
        if (ALWAYS_ON.has(key)) return null
        const next = hiddenSet.has(key)
          ? [...hiddenSet].filter((k) => k !== key)
          : [...hiddenSet, key]
        return store?.update('hosp_visibility', RECORD_ID, { hidden: next })
      },
      showAll: () => store?.update('hosp_visibility', RECORD_ID, { hidden: [] }),
      // The two presets a demo actually wants, rather than fourteen switches
      // to work through in front of an audience.
      showOnly: (keys) => {
        const keep = new Set([...keys, ...ALWAYS_ON])
        return store?.update('hosp_visibility', RECORD_ID, {
          hidden: MENU.map((g) => g.key).filter((k) => !keep.has(k)),
        })
      },
    }
  }, [row, store])

  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>
}

export function useVisibility() {
  const ctx = useContext(VisibilityContext)
  // A sensible fallback so a component rendered outside the provider — which
  // the portal smoke test does for every page — shows the whole menu rather
  // than none of it.
  return ctx || {
    hidden: [], isHidden: () => false, canHide: () => true, menu: MENU,
    toggle: () => {}, showAll: () => {}, showOnly: () => {},
  }
}
