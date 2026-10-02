'use client'

// Navigation for the HEPA compliance portal.
//
// Grouped by the client's own three focus areas rather than by our data model,
// because those are what the demo is judged against. Their brief names them:
// electronic document management and storage; SAP integration; and HEPA
// certification document lifecycle management. A reviewer looking for "where is
// the lifecycle piece" should find a group with that name, not have to infer it
// from a list of registers.
//
// The registers come first anyway, because none of the three focus areas mean
// anything until you can see the filters and the tests they are about.

const s = (p) => (c) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
)

const ICONS = {
  overview: s(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  // A filter cartridge: pleated media in a frame.
  filters: s(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M11 4v16M15 4v16M19 4v16" /></>),
  tests: s(<><path d="M9 3h6M10 3v6.5L5.2 18a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3L14 9.5V3" /><path d="M7.5 15h9" /></>),
  // The wrench the product's own sidebar uses for Maintenance.
  maintenance: s(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />),
  // The clipboard the product's own sidebar uses for Inspection.
  inspection: s(<><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>),
  reports: s(<><path d="M3 3v18h18" /><path d="m7 14 3-4 4 3 5-7" /></>),
  leaks: s(<><path d="M12 2.69 17.66 8.35a8 8 0 1 1-11.31 0z" /><path d="M12 18v.01M12 12v3" /></>),
  replacements: s(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>),
  documents: s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15h6M9 11h3" /></>),
  retention: s(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  export: s(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>),
  lifecycle: s(<><path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9" /></>),
  approvals: s(<><path d="M20 6 9 17l-5-5" /></>),
  notifications: s(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  sap: s(<><rect x="2" y="4" width="8" height="7" rx="1.5" /><rect x="14" y="13" width="8" height="7" rx="1.5" /><path d="M10 7.5h4a2 2 0 0 1 2 2V13" /><path d="M14 16.5h-4a2 2 0 0 1-2-2V11" /></>),
  sync: s(<><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></>),
  settings: s(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
}

export const sectionIcon = (key, color = '#64748b') => (ICONS[key] ? ICONS[key](color) : null)

export const MENU = [
  { key: 'overview', label: 'Overview', icon: 'overview', single: true, kw: 'overview dashboard compliance audit readiness summary home' },

  // ── the three the customer asked for, first ─────────────────────────────
  //
  // Their brief names three focus areas and this portal exists because of
  // them, so they sit directly under Overview where a reviewer looking for
  // "where is the lifecycle piece" finds it without scrolling past a CMMS they
  // already own. The general maintenance modules follow, because they are the
  // product this sits inside rather than the reason for the conversation.
  {
    // Focus Area 1 — electronic document management and storage.
    key: 'documents-grp', label: 'Documents', icon: 'documents',
    children: [
      { key: 'repository', label: 'Repository', kw: 'repository search retrieve filter id cleanroom date range technician outcome central store certificates' },
      { key: 'retention', label: 'Retention', kw: 'retention period expiry legal hold regulatory fda eu gmp counter policy delete' },
      { key: 'audit-export', label: 'Audit Export', kw: 'audit export package fda eu gmp inspector evidence pack download pdf report' },
    ],
  },
  {
    // Focus Area 3 — the one 21 CFR Part 11 is judged on.
    key: 'lifecycle-grp', label: 'Lifecycle', icon: 'lifecycle',
    children: [
      { key: 'lifecycle', label: 'Lifecycle Board', kw: 'lifecycle stage created routed review approved signed locked audit ready workflow routing' },
      { key: 'approvals', label: 'Approvals', kw: 'approval review reviewer electronic signature e-signature 21 cfr part 11 meaning identity timestamp reject' },
      { key: 'notifications', label: 'Notifications', kw: 'notification escalation due soon overdue alert lead time certification due reminder manager' },
    ],
  },
  // ── the work the site does, before the systems it does it through ───────
  //
  // Inspection first, then Maintenance, then SAP. The three used to run the
  // other way round, which put an integration above the rounds and orders it
  // carries — a reviewer opening this portal is looking for the work, and the
  // interface that syncs it is the last thing they ask about.
  {
    key: 'inspection-grp', label: 'Inspection', icon: 'inspection',
    children: [
      { key: 'inspections', label: 'Inspection Reports', kw: 'inspection report round walk gowning pressure cascade housing seal ahu ductwork environmental monitoring result pass fail observations findings score inspector start run' },
      { key: 'inspection-reminder', label: 'Inspection Reminder', kw: 'inspection reminder due overdue schedule next round frequency daily weekly monthly quarterly assigned roll forward aseptic core' },
      { key: 'incidents', label: 'Incident Reports', kw: 'incident excursion particle count pressure cascade loss seal breach gowning discipline deviation severity root cause capa downtime investigation classification' },
      { key: 'checklists', label: 'Checklist', kw: 'checklist procedure sop iso 14644-3 annex b steps run complete photometer scan changeover round template create build ai generate' },
    ],
  },
  {
    key: 'maintenance-grp', label: 'Maintenance', icon: 'maintenance',
    children: [
      { key: 'work-orders', label: 'Work Orders', kw: 'work order wo pm01 pm02 pm04 corrective preventive replacement job dispatch open completed priority sap order raise create new' },
      { key: 'requests', label: 'Maintenance Requests', kw: 'request report raise observed gasket damage triage convert reject urgency somebody noticed' },
      { key: 'pm-schedules', label: 'PM Schedules', kw: 'pm schedule preventive maintenance plan calendar interval quarterly semi-annual frequency due next last done compliance' },
    ],
  },
  {
    // Focus Area 2 — SAP integration.
    key: 'sap-grp', label: 'SAP', icon: 'sap',
    children: [
      { key: 'sap-assets', label: 'Asset Mapping', kw: 'sap equipment id functional location asset master no duplicate entry identifier mapping' },
      { key: 'sap-sync', label: 'Integration Portal', kw: 'sync status error retry queued pending work order idoc odata middleware conflict surfaced integration api endpoint gateway confirmation' },
    ],
  },
  {
    key: 'registers-grp', label: 'Registers', icon: 'filters',
    children: [
      { key: 'cleanrooms', label: 'Cleanrooms', kw: 'cleanroom room location iso class grade aseptic core gowning fill line lyophilization suite area' },
      { key: 'filters', label: 'Filter Registry', kw: 'filter registry hepa asset cleanroom iso class install date qr code test interval status' },
      { key: 'tests', label: 'DOP/PAO Tests', kw: 'dop pao integrity test penetration threshold pass fail scan points technician locked flagged' },
      { key: 'leaks', label: 'Leak Detection', kw: 'leak detection pressure differential breach threshold scheduled alert triggered trend' },
      { key: 'replacements', label: 'Replacements', kw: 'replacement change chain of custody serial supplier certificate pre post validation recert blocked' },
      { key: 'technicians', label: 'Technicians', kw: 'technician people team who took reading signed name identity workload pass rate attribution' },
    ],
  },
  { key: 'reports', label: 'Reports', icon: 'reports', single: true, kw: 'reports analytics charts by cleanroom iso grade technician month order class trend summary export figures' },
  { key: 'settings', label: 'Settings', icon: 'settings', single: true, kw: 'settings thresholds penetration pressure differential notification lead anchor dates source workbook' },
]

export const SECTION_LABEL = (() => {
  const map = {}
  MENU.forEach((g) => {
    if (g.single) map[g.key] = g.label
    else g.children.forEach((c) => { map[c.key] = c.label })
  })
  return map
})()
