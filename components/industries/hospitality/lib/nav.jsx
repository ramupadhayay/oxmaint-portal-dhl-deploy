'use client'

// Navigation for the Hospitality portal.
//
// The CMMS portal's menu is the product's whole catalogue — sixty sections, a
// good half of which a 98-suite hotel with two technicians will never open:
// Lubrication routes, Work Permits, Gate Pass, Shutdowns, Digital Twin. This is
// the same product's menu with those left out, in the order a hotel thinks:
// the day first, because that is the question that brought them here, then the
// property, then the work, then what somebody else audits.

const s = (p) => (c) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
)

const ICONS = {
  overview: s(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  'daily-schedule': s(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></>),
  'suite-rotation': s(<><path d="M4 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15" /><path d="M12 21V11a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v10" /><path d="M2 21h20" /><path d="M7 9h.01M7 13h.01M16 14h.01M16 17h.01" /></>),
  'my-tasks': s(<><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  calendar: s(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  suites: s(<><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M2 16h20" /><path d="M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>),
  assets: s(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></>),
  'asset-qr': s(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3z" /></>),
  locations: s(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  'work-orders': s(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>),
  requests: s(<><path d="M9 12h6M9 16h6M9 8h6" /><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /></>),
  'pm-schedules': s(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  checklists: s(<><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  compliance: s(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>),
  inspections: s(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="m8.5 11 2 2 4-4" /></>),
  incidents: s(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>),
  kpis: s(<><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></>),
  reports: s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15h6M9 11h3" /></>),
  parts: s(<><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" /><path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M10 12h4" /></>),
  vendors: s(<><path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></>),
  // A building with units. The community association's own icon, distinct
  // from the hotel's bed.
  community: s(<><rect x="3" y="3" width="8" height="18" rx="1.5" /><rect x="13" y="8" width="8" height="13" rx="1.5" /><path d="M6 7h2M6 11h2M6 15h2M16 12h2M16 16h2" /></>),
  teams: s(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  settings: s(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
}

export const sectionIcon = (key, color = '#64748b') => (ICONS[key] ? ICONS[key](color) : null)

export const MENU = [
  { key: 'overview', label: 'Overview', icon: 'overview', single: true, kw: 'overview dashboard home kpi today shift summary' },
  {
    // Directly under Overview, because the two are read together: the landing
    // screen carries the headline numbers and this is where they are defined
    // and where the year behind them lives. The day's work follows.
    key: 'analytics-grp', label: 'Analytics', icon: 'kpis',
    children: [
      { key: 'kpis', label: 'KPIs', kw: 'kpi key performance indicator metric target definition catalogue scorecard' },
      { key: 'reports', label: 'Reports', kw: 'reports analytics trend monthly cost backlog completion export' },
    ],
  },
  {
    key: 'day-grp', label: 'The Day', icon: 'daily-schedule',
    children: [
      { key: 'daily-schedule', label: "Today's Schedule", kw: 'today daily schedule shift plan print assign technician rounds pool suite pm work orders time budget handout' },
      { key: 'suite-rotation', label: 'Suite Rotation', kw: 'rotation board coverage cycle quarterly suites floor last pm overdue due progress' },
      { key: 'my-tasks', label: 'My Tasks', kw: 'my tasks queue assigned to me mine open overdue personal workload' },
      { key: 'calendar', label: 'Calendar', kw: 'calendar month week planner due dates pm schedule visual plan ahead' },
    ],
  },
  {
    key: 'property-grp', label: 'Property', icon: 'suites',
    children: [
      { key: 'suites', label: 'Suites', kw: 'suites rooms register studio one bedroom two bedroom floor pet friendly occupied' },
      { key: 'assets', label: 'Assets', kw: 'assets equipment ptac refrigerator dishwasher cooktop disposal water heater pool pump elevator register' },
      { key: 'asset-qr', label: 'Asset QR', kw: 'qr code label tag scan print sticker asset suite mobile' },
      { key: 'locations', label: 'Locations', kw: 'locations floors areas pool mechanical room laundry breakfast public areas hierarchy' },
    ],
  },
  {
    key: 'maint-grp', label: 'Maintenance', icon: 'work-orders',
    children: [
      { key: 'work-orders', label: 'Work Orders', kw: 'work order job repair guest request corrective breakdown open overdue assign complete' },
      { key: 'requests', label: 'Requests', kw: 'requests front desk guest housekeeping raise convert triage waiting' },
      { key: 'pm-schedules', label: 'PM Schedules', kw: 'preventive maintenance schedule frequency daily weekly monthly quarterly rotation library' },
      { key: 'checklists', label: 'Checklists', kw: 'checklist suite pm eighteen point kitchen hvac bathroom safety fixtures inspection' },
    ],
  },
  {
    key: 'safety-grp', label: 'Safety & Compliance', icon: 'compliance',
    children: [
      { key: 'compliance', label: 'Compliance Log', kw: 'compliance log pool chemistry ph chlorine fire extinguisher emergency lighting nfpa audit inspector record' },
      { key: 'inspections', label: 'Inspections', kw: 'inspections brand qa marriott fire marshal pool permit elevator certificate backflow sprinkler alarm hood external' },
      { key: 'incidents', label: 'Incidents', kw: 'incident guest injury slip property damage water leak smoke detector elevator entrapment report investigation' },
    ],
  },
  {
    key: 'inventory-grp', label: 'Inventory', icon: 'parts',
    children: [
      { key: 'parts', label: 'Parts', kw: 'parts spares stock filter gasket cartridge low stock reorder' },
      { key: 'vendors', label: 'Vendors', kw: 'vendors suppliers contractors otis pentair cintas ferguson grainger lead time' },
    ],
  },
  {
    // The community association side. Last in the menu because the hotel is
    // what this property is day to day; a board demo switches the hotel groups
    // off in Settings and this becomes the whole menu.
    key: 'community-grp', label: 'Community', icon: 'community',
    children: [
      { key: 'common-areas', label: 'Common Areas', kw: 'common area asset register condition score hoa condo board roof elevator pool parking clubhouse irrigation gate component' },
      { key: 'reserve', label: 'Reserve Planning', kw: 'reserve fund study capital forecast remaining useful life replacement cost funding gap special assessment underfunded percent funded contribution dues' },
      { key: 'vendor-pm', label: 'Vendor & Seasonal PM', kw: 'vendor contractor coi certificate of insurance seasonal pm landscaping pool winterisation invoice validation performance rebid work order' },
    ],
  },
  {
    key: 'org-grp', label: 'Organization', icon: 'teams',
    children: [
      { key: 'teams', label: 'Teams', kw: 'teams engineering housekeeping front office contracted members lead who does what' },
      { key: 'settings', label: 'Settings', kw: 'settings property organisation shift length rotation cycle preferences configuration' },
    ],
  },
]

export const SECTION_LABEL = (() => {
  const map = {}
  MENU.forEach((g) => {
    if (g.single) map[g.key] = g.label
    else g.children.forEach((c) => { map[c.key] = c.label })
  })
  return map
})()
