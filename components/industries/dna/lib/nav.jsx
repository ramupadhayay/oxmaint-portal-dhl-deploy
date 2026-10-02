// Navigation model for the DNA Technical Fabrics CMMS portal.
//
// The groups and the labels are the shipping product's, not this portal's own.
// That is the point of it: a prospect who sees "Asset Register" in the demo and
// "Assets Master" in the product they buy has been shown something that does not
// exist, and the confusion lands on the first day of onboarding rather than in
// the meeting. So the menu below mirrors
// components/industries/oxmaint/lib/nav.jsx — Dashboard, Asset, Maintenance,
// Operations, Inventory, Purchasing, Team — down to the wording of each entry.
//
// What is NOT carried across is every module the product has. This is one
// customer's dataset, and a menu offering Compliance, EHS, Shutdown Plans and
// Lubrication with nothing behind them would demonstrate emptiness. The rule is
// the product's names, for the modules this data can actually fill.
//
// Two entries have no equivalent in the product menu and are here deliberately.
// Downtime Log, because the customer asked for downtime tracking by name and the
// workbook carries it — in the shipping product that reporting lives across
// Incident Reports and the asset utilisation KPIs rather than in a labelled
// submodule, which is worth saying out loud in the demo. And AI Time Estimates,
// which sits as a single the way AI Auditor and Synapse AI do in the product.

const s = (p) => (c) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>)

// Glyphs taken from the product's own nav, so the same module wears the same
// icon in both.
const ICONS = {
  dashboard: s(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  assets: s(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></>),
  maintenance: s(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>),
  operations: s(<><path d="M4 4h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M15 4v4h4M8 12h8M8 16h6" /></>),
  inventory: s(<><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.1-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z" /><path d="M2.32 6.16 12 11l9.68-4.84M12 22.76V11" /></>),
  purchasing: s(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>),
  team: s(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  ai: s(<><circle cx="12" cy="12" r="2.4" /><circle cx="5" cy="6.5" r="1.7" /><circle cx="19" cy="6.5" r="1.7" /><circle cx="5" cy="17.5" r="1.7" /><circle cx="19" cy="17.5" r="1.7" /><path d="M6.4 7.6 10 10.6M17.6 7.6 14 10.6M6.4 16.4 10 13.4M17.6 16.4 14 13.4" /></>),
  organization: s(<><path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></>),
  source: s(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="m9 9 2 2 4-4" /></>),
}

export function sectionIcon(key, color = '#64748b') {
  return ICONS[key] ? ICONS[key](color) : null
}

/**
 * The icon for a section, taken from the group it belongs to — so a screen moved
 * between groups picks up the new group's icon rather than keeping the old one
 * and quietly disagreeing with the sidebar.
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
    key: 'dashboard-grp', label: 'Dashboard', icon: 'dashboard',
    children: [
      { key: 'overview', label: 'Overview', kw: 'overview dashboard home summary kpi status plant backlog overdue downtime compliance today' },
      { key: 'kpis', label: 'KPIs', kw: 'kpi key performance indicator metric target compliance mttr availability backlog wrench time scorecard organization' },
      { key: 'reports', label: 'Reports', kw: 'report dashboard analytics chart breakdown by type priority status department downtime pareto backlog preventive reactive export' },
    ],
  },
  {
    key: 'asset-grp', label: 'Asset', icon: 'assets',
    children: [
      { key: 'assets', label: 'Assets Master', kw: 'asset register master machine equipment spinning weaving loom dyeing fr finishing coating stenter boiler compressor chiller crane forklift criticality serial manufacturer model install' },
      { key: 'asset-qr', label: 'Assets QR', kw: 'qr code tag label print scan sticker mobile phone android apple barcode nameplate floor' },
    ],
  },
  {
    key: 'maint-grp', label: 'Maintenance', icon: 'maintenance',
    children: [
      { key: 'my-tasks', label: 'My Tasks', kw: 'my tasks assigned to me personal queue technician inbox today mine due workload' },
      { key: 'work-orders', label: 'Work Orders', kw: 'work order wo job corrective preventive emergency inspection open in progress on hold completed priority critical assigned overdue backlog' },
      { key: 'requests', label: 'Request Maintenance', kw: 'request raise report operator shift lead supervisor unassigned triage inbox incoming maintenance request' },
      { key: 'pm-schedules', label: 'PM Schedules', kw: 'pm preventive maintenance schedule recurring weekly monthly quarterly annual bi-weekly 500 hrs next due last done compliance checklist team' },
    ],
  },
  {
    key: 'ops-grp', label: 'Operations', icon: 'operations',
    children: [
      { key: 'calendar', label: 'Calendar', kw: 'calendar month schedule planner due dates diary grid week clash workload upcoming pm work orders' },
      { key: 'downtime', label: 'Downtime Log', kw: 'downtime outage stoppage unplanned planned reason code mechanical electrical duration hours pareto loss availability' },
    ],
  },
  {
    key: 'inv-grp', label: 'Inventory', icon: 'inventory',
    children: [
      { key: 'parts', label: 'Parts', kw: 'parts spares catalogue part number category unit cost reorder point supplier storeroom chemicals reed heald rotor bearing traveler belt gasket filter vfd motor plc' },
      { key: 'stocks', label: 'Stocks', kw: 'stock levels valuation on hand value storeroom low out of stock reorder coverage holding' },
      { key: 'vendors', label: 'Vendors', kw: 'vendor supplier oem groz-beckert rieter saurer dystar solvay huntsman siemens abb weg atlas copco cleaver-brooks grundfos toyota spend lines' },
      { key: 'labour', label: 'Labour', kw: 'labour hours logged technician time booking wrench time completed jobs effort allocation' },
    ],
  },
  {
    key: 'purch-grp', label: 'Purchasing', icon: 'purchasing',
    children: [
      { key: 'purchase-orders', label: 'Purchase Orders', kw: 'purchase order po procurement vendor supplier draft pending approval approved ordered received partially cancelled committed spend delivery expected raised for' },
      { key: 'demand-parts', label: 'Demand Parts', kw: 'demand parts requirement shortage below reorder requisition order quantity supplier cost procurement raise' },
    ],
  },
  {
    key: 'team', label: 'Team', icon: 'team', single: true,
    kw: 'team roster people technician shift day evening office skills coverage planner manager resource planning department',
  },
  {
    key: 'ai-estimates', label: 'AI Time Estimates', icon: 'ai', single: true,
    kw: 'ai estimate actual duration variance accuracy prediction time task model hours over under bias',
  },
  {
    key: 'locations', label: 'Locations & Sites', icon: 'organization', single: true,
    kw: 'location site department area plant hierarchy spinning warping weaving dyeing finishing qc warehouse utilities maintenance yard columbus georgia',
  },
  {
    key: 'sources', label: 'Data & Notes', icon: 'source', single: true,
    kw: 'source data notes provenance workbook sheet read me sample fictional demo dates anchor coverage gaps caveats',
  },
]

/** Flat list, for the sidebar filter and for checking a slug exists. */
export const SECTIONS = MENU.flatMap((g) => (
  g.single
    ? [{ key: g.key, label: g.label, group: g.label, kw: g.kw || '' }]
    : g.children.map((c) => ({ key: c.key, label: c.label, group: g.label, kw: c.kw || '' }))
))

export const SECTION_LABEL = Object.fromEntries(SECTIONS.map((x) => [x.key, x.label]))
