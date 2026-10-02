'use client'

// The site filter, shared by every screen.
//
// Same idea as the Oxmaint portal's: the picker in the header is not decoration,
// it changes what the page below is counting, and it has to survive navigation
// between screens to be worth having.
//
// What differs here is the scoping rule. This data is a six-site estate where
// several tables are estate-wide by nature — the failure code list, the
// criticality matrix, the KPI targets, the stakeholder RACI — and those must not
// vanish when someone picks a site. So a row with no site is always in scope,
// and only rows that name a different site are filtered out.

import { createContext, useContext, useMemo, useState } from 'react'
import { SITES } from './data'

const SiteContext = createContext({
  siteId: 'all', setSiteId: () => {}, sites: SITES, siteName: 'All Sites', scope: (rows) => rows,
})

export function SiteProvider({ children }) {
  const [siteId, setSiteId] = useState('all')

  const value = useMemo(() => ({
    siteId,
    setSiteId,
    sites: SITES,
    siteName: siteId === 'all' ? 'All Sites' : (SITES.find((s) => s.siteId === siteId)?.siteName || 'All Sites'),
    scope: (rows) => (siteId === 'all' ? rows : rows.filter((r) => !r.siteId || r.siteId === siteId)),
  }), [siteId])

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
