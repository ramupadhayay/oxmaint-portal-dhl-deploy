'use client'

// The site filter.
//
// Oxmaint is multi-site, and the site picker in the header is not decoration —
// it changes what every screen below it is counting. Putting it in a context
// rather than in each page's own state is what makes that true: pick Rotherham
// on the work-order list, walk to Assets, and the filter is still on. A picker
// that silently resets between pages teaches an audience not to trust it.

import { createContext, useContext, useMemo, useState } from 'react'
import { SITES } from './data'

const SiteContext = createContext({ siteId: 'all', setSiteId: () => {}, sites: SITES, scope: (rows) => rows })

export function SiteProvider({ children }) {
  const [siteId, setSiteId] = useState('all')

  const value = useMemo(() => ({
    siteId,
    setSiteId,
    sites: SITES,
    siteName: siteId === 'all' ? 'All Sites' : (SITES.find((s) => s.site_id === siteId)?.site_name || 'All Sites'),
    // Rows without a site_id — organisation-level records like vendors — are
    // never filtered out. Hiding them under a site filter would be wrong, not
    // just unhelpful: they belong to every site.
    scope: (rows) => (siteId === 'all' ? rows : rows.filter((r) => !r.site_id || r.site_id === siteId)),
  }), [siteId])

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
