// Navigation model for the WAGA Energy compliance portal.
//
// Same shape as the other two portals' — groups with children, `single` for a
// one-screen group, keywords for the sidebar filter — so all three read the
// same structure and no menu code has to learn a second one.
//
// The order follows how a compliance manager actually works rather than the
// order of sheets in the workbook: what is the state of things (Overview), what
// are we permitted to do (Permits), what does that oblige us to do
// (Requirements), when is it due (Calendar), what are the numbers we must stay
// under (Limits), and what went wrong (Deviations). Safety is a second block
// because it comes from a different source document and a different owner.
//
// One screen has no equivalent in the supplied mockup: Requirements Register.
// The mockup was drawn against the first workbook, and the register of 34
// obligations — the largest and most useful table in the dataset — had no
// screen at all. A portal that shows the permits but not what they require
// leaves out the part a compliance manager is actually accountable for.

const s = (p) => (c) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>)

const ICONS = {
  overview: s(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  compliance: s(<><path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4" /><path d="M9 11V7a3 3 0 0 1 6 0v4" /><path d="M12 15v2" /></>),
  safety: s(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>),
  source: s(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="m9 9 2 2 4-4" /></>),
  team: s(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  reports: s(<><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="7" /><rect x="12" y="7" width="3" height="11" /><rect x="17" y="13" width="3" height="5" /></>),
  home: s(<><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>),
  site: s(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
}

export function sectionIcon(key, color = '#64748b') {
  return ICONS[key] ? ICONS[key](color) : null
}

/**
 * The icon for a section, taken from the group it belongs to — so a screen
 * moved between groups picks up the new group's icon instead of keeping the old
 * one and quietly disagreeing with the sidebar.
 */
export function iconForSection(key, color = '#15227a') {
  for (const g of MENU) {
    if (g.single && g.key === key) return sectionIcon(g.icon || g.key, color)
    if (g.children?.some((c) => c.key === key)) return sectionIcon(g.icon, color)
  }
  return null
}

export const MENU = [
  {
    key: 'getting-started', label: 'Getting Started', icon: 'home', single: true,
    kw: 'getting started home welcome hello dashboard sections navigate jump map begin',
  },
  {
    key: 'overview', label: 'Compliance Overview', icon: 'overview', single: true,
    kw: 'overview dashboard summary home status permits deadlines deviations renewal watch kpi',
  },
  {
    // Above both work groups rather than inside one. Sites is not a compliance
    // record — it is the estate the compliance records are *about*, and the
    // header's scope filter reads it for Safety & EHS just as much as for
    // Compliance & Audit. Filed under either group it would read as belonging
    // to that group's work, which is how somebody concludes the filter only
    // applies there.
    key: 'sites', label: 'Sites', icon: 'site', single: true,
    kw: 'site sites plant facility estate country state region location legal entity address add new mckean scott area bordeaux geography scope filter organisation',
  },
  {
    key: 'compliance-grp', label: 'Compliance & Audit', icon: 'compliance',
    children: [
      { key: 'permits', label: 'Permits & Licenses', kw: 'permit licence license authorization air plan approval npdes stormwater residual waste title v construction agency pa dep iowa dnr expiry renewal' },
      { key: 'requirements', label: 'Requirements Register', kw: 'requirement obligation register recordkeeping inspection reporting sampling monitoring fee renewal frequency deadline retention citation source' },
      { key: 'calendar', label: 'Compliance Calendar', kw: 'calendar schedule due date deadline upcoming recurring weekly monthly quarterly semiannual annual occurrence generated' },
      { key: 'parameters', label: 'Limits & Monitoring', kw: 'limit parameter monitoring emission co nox tpy lb/hr combustion temperature operating hours leak ppmv threshold alert' },
      { key: 'deviations', label: 'Deviations & CAPA', kw: 'deviation capa corrective action non-compliance late report stack test root cause closed investigation' },
    ],
  },
  {
    key: 'safety-grp', label: 'Safety & EHS', icon: 'safety',
    children: [
      { key: 'safety', label: 'Safety & EHS Overview', kw: 'safety ehs overview checklist workflows jsa permit to work loto incident training scope' },
      { key: 'pre-task', label: 'Pre-Task Safety / JSA', kw: 'pre-task jsa job safety analysis hazard control ppe risk assessment task authorization acknowledgement' },
      { key: 'loto', label: 'LOTO / Permit to Work', kw: 'loto lockout tagout isolation lock record hot work confined space energized electrical critical lift permit' },
      { key: 'incidents', label: 'Incident / RCA', kw: 'incident rca root cause osha 301 investigation injury near miss recordable' },
      { key: 'training', label: 'Training & Compliance', kw: 'training biogas osha 10 nfpa 70e loto heights confined space spill leak prevention qualification' },
    ],
  },
  {
    key: 'reports', label: 'Reports', icon: 'reports', single: true,
    kw: 'report reports overview rollup summary export pdf csv excel by permit by site by country by agency by category regulator filing status deviation limits download print meeting regulator pack',
  },
  {
    key: 'team', label: 'Team', icon: 'team', single: true,
    kw: 'team people users members roster directory qhse operations project delivery business development finance email department access login',
  },
  {
    key: 'sources', label: 'Source & Verification', icon: 'source', single: true,
    kw: 'source verification log provenance evidence traceability confidence permit pdf tracker audit trail readme rules',
  },
]

/** Flat list, for the sidebar filter and for checking a slug exists. */
export const SECTIONS = MENU.flatMap((g) => (
  g.single
    ? [{ key: g.key, label: g.label, group: g.label, kw: g.kw || '' }]
    : g.children.map((c) => ({ key: c.key, label: c.label, group: g.label, kw: c.kw || '' }))
))

export const SECTION_LABEL = Object.fromEntries(SECTIONS.map((x) => [x.key, x.label]))
