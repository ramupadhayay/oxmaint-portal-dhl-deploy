'use client'

// The scope filter, shared by every screen.
//
// It began as a site picker. The client asked for "another section or level
// above sites … goal would be to filter by country as well", so it is now a
// three-level geography — country, then state or region, then site — with one
// selection shared across the portal. Pick McKean once and stay there; pick
// Pennsylvania and every screen counts both the permits and the obligations
// that sit under it.
//
// The levels are not invented. Every site row in the workbook already carries
// `country` and `state` (the import maps the Sites sheet's own columns), so the
// hierarchy is read out of the data rather than declared here. Add a French site
// to the workbook and France appears in the picker; nothing in this file needs
// to know it exists. That is also why the labels are the workbook's own strings
// — "USA", "PA" — rather than expanded to "United States" or "Pennsylvania":
// this dataset is read back against permit PDFs, and a portal that renders a
// value the source never wrote is a portal you have to double-check.
//
// The scoping rule is the one thing that must not change. Several tables are
// organisation-wide by nature — the safety checklist template, most of the
// training matrix, the verification log — and they must not vanish when someone
// narrows the filter. So a row with no site is always in scope, and only rows
// naming a site outside the selection are filtered out. Widening from one site
// to a set of sites keeps that rule exactly; it only grows the set.

import { createContext, useContext, useMemo, useState } from 'react'
import { SITES } from './data'
import { useStore } from './store'

export const ALL = 'all'

/**
 * The geography the dataset actually contains, counted from the site rows.
 *
 * Sorted by name so the picker is stable, and each level carries its own site
 * count — a country with one site should say so rather than implying breadth
 * the trial does not have.
 */
export function buildGeography(sites) {
  const countries = new Map()

  for (const s of sites) {
    // A site with no country still has to be reachable. It goes under a bucket
    // named for the absence rather than being silently dropped from the picker,
    // which is how a site disappears from a portal nobody notices.
    const cKey = s.country || ''
    const country = countries.get(cKey) || { key: cKey, label: s.country || 'No country stated', states: new Map(), sites: [] }
    country.sites.push(s)

    const stKey = s.state || ''
    const state = country.states.get(stKey) || { key: stKey, label: s.state || 'No state stated', sites: [] }
    state.sites.push(s)
    country.states.set(stKey, state)

    countries.set(cKey, country)
  }

  const byLabel = (a, b) => a.label.localeCompare(b.label)

  return [...countries.values()]
    .map((c) => ({
      ...c,
      siteCount: c.sites.length,
      states: [...c.states.values()]
        .map((st) => ({ ...st, siteCount: st.sites.length }))
        .sort(byLabel),
    }))
    .sort(byLabel)
}

/**
 * A site added in the portal, in the shape the workbook's own rows have.
 *
 * `_added` is the one extra field, and every screen that lists sites shows it —
 * the workbook is the verified record of what WAGA operates, and a site typed
 * into the portal must never be mistaken for one read off a permit document.
 */
const asSite = (r) => ({
  siteId: r.siteId || r.recordId,
  code: r.code || '',
  legalEntity: r.legalEntity || '',
  siteName: r.siteName || r.code || 'Untitled site',
  address: r.address || '',
  city: r.city || '',
  state: r.state || '',
  zip: r.zip || '',
  country: r.country || '',
  status: r.status || 'Added in the portal',
  _added: true,
  recordId: r.recordId,
})

const SEEDED_GEOGRAPHY = buildGeography(SITES)

const NO_SCOPE = {
  level: 'all', countryKey: ALL, stateKey: ALL, siteId: ALL,
  setSiteId: () => {}, setCountry: () => {}, setState: () => {}, setScope: () => {}, clearScope: () => {},
  sites: SITES, geography: SEEDED_GEOGRAPHY, countries: SEEDED_GEOGRAPHY,
  states: [], visibleSites: SITES, addedSites: [],
  // Outside the provider only the workbook's sites exist, which is the right
  // answer there: a screen rendered without the store has no added ones.
  codeOf: (id) => SITES.find((s) => s.siteId === id)?.code || '',
  newRecordSiteId: SITES[0]?.siteId || '',
  emptyFor: (filtered) => filtered,
  siteName: 'All Trial Sites', scopeName: 'All Trial Sites', scopeLevelLabel: 'All sites', siteCode: '',
  scope: (rows) => rows, inScope: () => true, scopedSiteIds: SITES.map((s) => s.siteId),
  multiSite: SITES.length > 1, multiCountry: SEEDED_GEOGRAPHY.length > 1,
}

const SiteContext = createContext(NO_SCOPE)

export function SiteProvider({ children }) {
  // One selection, held as the narrowest thing chosen. A site implies its state
  // and country, so storing all three separately would let them disagree.
  const [sel, setSel] = useState({ countryKey: ALL, stateKey: ALL, siteId: ALL })

  // Sites added in the portal, on top of the workbook's. Read from the record
  // store rather than a second copy, so adding a site on the Sites screen puts
  // its country in the header filter without a reload.
  const store = useStore()
  const addedRows = store?.records?.waga_site
  const addedSites = useMemo(() => (addedRows || []).map(asSite), [addedRows])

  const ALL_SITES = useMemo(() => [...SITES, ...addedSites], [addedSites])
  const GEOGRAPHY = useMemo(
    () => (addedSites.length ? buildGeography(ALL_SITES) : SEEDED_GEOGRAPHY),
    [addedSites, ALL_SITES],
  )

  const value = useMemo(() => {
    const { countryKey, stateKey, siteId } = sel

    const country = countryKey === ALL ? null : GEOGRAPHY.find((c) => c.key === countryKey) || null
    const state = !country || stateKey === ALL ? null : country.states.find((s) => s.key === stateKey) || null
    const site = siteId === ALL ? null : ALL_SITES.find((s) => s.siteId === siteId) || null

    // Which sites the current selection covers. Everything downstream — the
    // scope filter, the counts, the reports — reads this one set, so no screen
    // can work out the membership differently from another.
    const scopedSites = site ? [site] : state ? state.sites : country ? country.sites : ALL_SITES
    const scopedSiteIds = scopedSites.map((s) => s.siteId)
    const allowed = new Set(scopedSiteIds)
    const isEverything = scopedSites.length === ALL_SITES.length

    const level = site ? 'site' : state ? 'state' : country ? 'country' : 'all'
    const scopeName = site ? site.siteName
      : state ? state.label
        : country ? country.label
          : 'All Trial Sites'

    return {
      level,
      countryKey,
      stateKey,
      siteId,

      // Setters. Choosing a level clears everything narrower than it, so the
      // picker can never show "USA / PA / a site in Iowa".
      setCountry: (key) => setSel({ countryKey: key, stateKey: ALL, siteId: ALL }),
      setState: (key) => setSel((p) => ({ ...p, stateKey: key, siteId: ALL })),
      // Kept under its old name because TopBar and any future caller reach for
      // it; selecting a site also pins the country and state it belongs to.
      setSiteId: (id) => {
        const s = ALL_SITES.find((x) => x.siteId === id)
        setSel(id === ALL || !s
          ? { countryKey: ALL, stateKey: ALL, siteId: ALL }
          : { countryKey: s.country || '', stateKey: s.state || '', siteId: id })
      },
      // One call for the picker: it emits whichever level was chosen.
      setScope: (next) => setSel({ countryKey: ALL, stateKey: ALL, siteId: ALL, ...next }),
      clearScope: () => setSel({ countryKey: ALL, stateKey: ALL, siteId: ALL }),

      // The code for any site, including one added in the portal.
      //
      // lib/data's own `siteCode` only knows the workbook's sites, so a permit
      // filed against a site created here resolved to an em dash — which then
      // showed as "Organisation-wide" in the register and, worse, went into the
      // permit's own id as PERMIT-—-NEW-001. Any screen that builds a code or an
      // id for a live record uses this.
      codeOf: (id) => ALL_SITES.find((s) => s.siteId === id)?.code || '',

      // Which site a new record should be filed against unless the person says
      // otherwise: the one they are looking at. Every "new" dialog used to open
      // on the workbook's first site, so somebody scoped to a site they had
      // just added filed the permit against a different one and watched their
      // own screen stay empty.
      newRecordSiteId: site?.siteId || scopedSites[0]?.siteId || '',

      /**
       * What an empty table should say under the current scope.
       *
       * A site added in the portal starts with nothing in it, and every screen
       * answered that with the same line it uses for a filter that matched
       * nothing — "No permits match these filters" — which reads as a fault
       * rather than as a new site. This says which site is empty and what the
       * next step is, and leaves the filter wording alone everywhere else.
       *
       * @param filtered what to say when a filter is simply too narrow
       * @param nothing  what the screen holds, e.g. "permits"
       * @param next     the action that puts the first one in, e.g. "New permit"
       */
      emptyFor: (filtered, nothing, next) => {
        if (!site) return filtered
        const opener = site._added
          ? `${site.siteName} was added in the portal, so it carries no ${nothing} until they are recorded for it.`
          : `Nothing is recorded under ${nothing} for ${site.siteName}.`
        return next ? `${opener} Use ${next}.` : opener
      },

      sites: ALL_SITES,
      seededSites: SITES,
      addedSites,
      geography: GEOGRAPHY,
      countries: GEOGRAPHY,
      states: country ? country.states : GEOGRAPHY.flatMap((c) => c.states),
      visibleSites: scopedSites,
      scopedSiteIds,

      // `siteName` is what eight screens already put in their subtitle, so it
      // keeps its name and now answers for whatever level is selected — the
      // sentence "… — Pennsylvania" reads correctly where "… — All Trial Sites"
      // would have been wrong.
      siteName: scopeName,
      scopeName,
      scopeLevelLabel: { all: 'All sites', country: 'Country', state: 'State / region', site: 'Site' }[level],
      siteCode: site?.code || '',

      // Unchanged in meaning: a row with no site is always in scope. The only
      // difference is that "the site" is now "the sites the selection covers",
      // and when nothing is selected that is every site — the same list the
      // unfiltered portal showed.
      scope: (rows) => (isEverything ? rows : rows.filter((r) => !r.siteId || allowed.has(r.siteId))),
      inScope: (id) => !id || allowed.has(id),

      multiSite: ALL_SITES.length > 1,
      multiCountry: GEOGRAPHY.length > 1,
    }
  }, [sel, ALL_SITES, GEOGRAPHY, addedSites])

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
