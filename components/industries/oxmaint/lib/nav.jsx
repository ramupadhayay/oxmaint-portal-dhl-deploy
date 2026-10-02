// Navigation model for the Oxmaint CMMS portal — used by both the Sidebar
// (grouped menu) and the TopBar command palette, so the section list, keywords
// and icons stay in one place.
//
// The groups, their order and their labels are the product's own sidebar,
// read off it rather than remembered: Getting Started, Dashboard, KPIs, Synapse
// AI, Calendar, Asset, Maintenance, Inspection, EHS, Logbook Operations,
// Shutdown, Purchasing, Inventory, Integrations, Team, Document, Organization,
// Partner Hub, Help & Support. A demo whose menu is a rearrangement of the
// product's is a demo the audience has to translate while they watch.
//
// This build's own modules — RCM Reliability, Digital Twin, AI Vision, AI
// Auditor, Compliance, and the extra children under Maintenance, EHS,
// Purchasing and Inventory — sit among them rather than in a wing of their own,
// so the menu reads as one product. Where a group exists in both, the product's
// children come first in the product's order and this build's follow.
//
// What is deliberately NOT carried over is `ctm`'s customer-specific verticals
// (Hospital BME, ArrayMed, Galvanizing, Roll Management, HVAC Refrigerant, CFBC
// Tube Inspection, AI Fabric Planning, GSE Pre-Op). This portal exists to be the
// one that is *not* built around a single industry — every other portal on this
// platform already is — so a menu full of one hospital's modules would defeat
// the point of it.

import { DOMAIN } from './data'

const s = (p) => (c) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>)

const ICONS = {
  'getting-started': s(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>),
  'chiller': s(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9v6M12 9v6M17 9v6" /><path d="M3 12h18" /></>),
  'chiller-monitor': s(<><path d="M3 12h4l2-6 4 12 2-6h6" /></>),
  'leak-detection': s(<><path d="M12 2.69 17.66 8.35a8 8 0 1 1-11.31 0z" /><path d="M12 18v.01M12 12v3" /></>),
  'chiller-efficiency': s(<><path d="M13 2 3 14h9l-1 8 10-12h-9z" /></>),
  'chiller-solution': s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6M9 17h4" /></>),
  // ── GSE fleet (DHL pack) ─────────────────────────────────────────────
  // A tug, a gauge, a battery, a snowflake and a checklist — the five things
  // the module is actually about, so the menu reads before it is read.
  'gse': s(<><path d="M3 17h2a2 2 0 0 0 4 0h6a2 2 0 0 0 4 0h2" /><path d="M5 17V9h6l3 4h5v4" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>),
  'gse-readiness': s(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>),
  'gse-meters': s(<><circle cx="12" cy="12" r="9" /><path d="M12 12 16 9" /><path d="M12 7v1M17 12h-1M12 17v-1M7 12h1" /></>),
  'gse-battery': s(<><rect x="2" y="7" width="16" height="10" rx="2" /><path d="M22 11v2" /><path d="m10 9-2 3h3l-2 3" /></>),
  'gse-seasonal': s(<><path d="M12 2v20M2 12h20" /><path d="m5 5 14 14M19 5 5 19" /><path d="M9 3h6M9 21h6" /></>),
  'gse-stores': s(<><path d="M3 9 12 3l9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-8h6v8" /></>),
  'gse-reliability': s(<><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 12 16 8" /><path d="M21 3v6h-6" /></>),
  'gse-workmanship': s(<><path d="M12 3 4 7v6c0 4.5 3.2 7.9 8 9 4.8-1.1 8-4.5 8-9V7z" /><path d="m9 12 2 2 4-4" /></>),
  'gse-sap': s(<><rect x="3" y="4" width="18" height="6" rx="1" /><rect x="3" y="14" width="18" height="6" rx="1" /><path d="M7 10v4M17 10v4" /></>),
  'gse-next-five': s(<><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /><circle cx="19" cy="7" r="2" /></>),
  'gse-five-year': s(<><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-7" /><path d="M16 7h4v4" /></>),
  'gse-warranty': s(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12h6M12 9v6" /></>),
  'gse-parts-kits': s(<><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>),
  'gse-spare-insights': s(<><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" /><path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" /></>),
  'gse-audit-report': s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h8M8 17h5" /></>),
  'gse-cycle-counts': s(<><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 13h6M9 17h4" /></>),
  'gse-tech-kpi': s(<><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4" /><path d="M16 21v-4M19 21v-7M22 21v-2" /></>),
  'gse-rfp': s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="m9 15 1.5 1.5L14 13" /></>),
  'gse-voice': s(<><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z" /></>),
  'gse-waterfall': s(<><path d="M3 5h6v4H3zM15 5h6v4h-6zM9 15h6v4H9z" /><path d="M6 9v2h12V9M12 11v4" /></>),
  humanoid: s(<><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><path d="M8 9h8" /><path d="M12 11l-3 5M12 11l3 5" /><path d="M9 20l3-4 3 4" /></>),

  // ── Life safety (hospital pack) ───────────────────────────────────────
  'fls': s(<><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-4 4-8 4-8z" /><path d="M5 21h14" /><path d="M12 14v7" /></>),
  'fls-compliance': s(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
  'fls-survey': s(<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>),
  'fls-evidence': s(<><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /><path d="m9 15 2 2 4-4" /></>),
  'fls-ilsm': s(<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="M12 8v4" /><path d="M12 15h.01" /></>),
  'fls-soc': s(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h3" /><path d="m15 17 2 2 3-3" /></>),

  'ai-auditor': s(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="m8.5 11 2 2 4-4" /></>),

  dashboard: s(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>),
  kpis: s(<><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></>),
  reports: s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15h6M9 11h3" /></>),
  'digital-twin': s(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>),

  assets: s(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></>),
  'asset-qr': s(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM18 18h3v3h-3z" /></>),

  'my-tasks': s(<><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  'work-orders': s(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>),
  requests: s(<><path d="M9 12h6M9 16h6M9 8h6" /><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /></>),
  'pm-forecast': s(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /><path d="m8 17 3-3 2 2 3-4" /></>),
  'pm-schedules': s(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>),
  approvals: s(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>),
  lubrication: s(<><path d="M12 2.69 17.66 8.35a8 8 0 1 1-11.31 0z" /><path d="M12 18a4 4 0 0 0 4-4" /></>),
  'workflow-designer': s(<><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M9 6h6a3 3 0 0 1 3 3v6" /></>),
  'rcm-reliability': s(<><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z" /><path d="M12 8v4l2.5 2.5" /></>),

  inspections: s(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6M11 8v6" /></>),
  reminder: s(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  incidents: s(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>),
  checklists: s(<><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  rca: s(<><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5v4M12 11.5 6.5 17M12 11.5 17.5 17" /></>),

  shutdown: s(<><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" /><line x1="12" y1="2" x2="12" y2="12" /></>),
  'shutdown-plans': s(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 15h8" /></>),

  logbook: s(<><path d="M4 4h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M15 4v4h4M8 12h8M8 16h6M8 8h4" /></>),
  'maintenance-logbook': s(<><path d="M4 4h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M15 4v4h4" /><path d="m9 14 2 2 4-4" /></>),
  'logbook-routes': s(<><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H14a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8" /></>),

  calendar: s(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),

  parts: s(<><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.1-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z" /><path d="M2.32 6.16 12 11l9.68-4.84M12 22.76V11" /></>),
  stocks: s(<><path d="M20 7h-9M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></>),
  vendors: s(<><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M9 21v-6h6v6" /></>),
  scraps: s(<><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>),
  labour: s(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 12h-6" /></>),
  'gate-pass': s(<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M8 6V4h8v2M6 18v2M18 18v2" /><path d="m10 12 2 2 4-4" /></>),

  'purchase-orders': s(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>),
  'po-approvals': s(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="m9 13 2 2 4-4" /></>),
  'demand-parts': s(<><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>),

  ehs: s(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>),
  certificates: s(<><circle cx="12" cy="9" r="6" /><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8" /></>),
  lototo: s(<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 15v2" /></>),
  'safety-clearances': s(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>),
  permits: s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="m9 15 2 2 4-4" /></>),

  compliance: s(<><path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4" /><path d="M9 11V7a3 3 0 0 1 6 0v4" /><path d="M12 15v2" /></>),
  'audit-trail': s(<><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /></>),
  capa: s(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="m9 13 2 2 4-4" /></>),
  validation: s(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m8 12 3 3 5-6" /></>),
  reviews: s(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></>),
  vault: s(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="4" /><path d="M12 8v1M12 15v1M8 12h1M15 12h1" /></>),

  synapse: s(<><circle cx="12" cy="12" r="2.4" /><circle cx="5" cy="6.5" r="1.7" /><circle cx="19" cy="6.5" r="1.7" /><circle cx="5" cy="17.5" r="1.7" /><circle cx="19" cy="17.5" r="1.7" /><path d="M6.4 7.6 10 10.6M17.6 7.6 14 10.6M6.4 16.4 10 13.4M17.6 16.4 14 13.4" /></>),
  'ai-vision': s(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>),

  documents: s(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M16 13H8M16 17H8M10 9H8" /></>),
  members: s(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  teams: s(<><rect x="2" y="7" width="8" height="6" rx="1" /><rect x="14" y="7" width="8" height="6" rx="1" /><path d="M6 13v4h12v-4" /></>),
  biometrics: s(<><path d="M12 11c0 3-1 5.5-1 5.5" /><path d="M8.5 7.5a5 5 0 0 1 7 4.5c0 2-.5 4-1 5.5" /><path d="M5 10a7 7 0 0 1 12-5" /><path d="M5.5 15c.5-1.5.5-3 .5-5" /></>),

  'partner-hub': s(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m17 11 2 2 4-4" /></>),
  financial: s(<><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>),
  integrations: s(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></>),

  organization: s(<><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" /></>),
  locations: s(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  subscription: s(<><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>),
  settings: s(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.35.42.63.77.77H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
  'white-label': s(<><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="14" r="2.5" /><circle cx="8.5" cy="7.5" r="2.5" /><circle cx="6.5" cy="14" r="2.5" /><path d="M12 22a10 10 0 1 1 0-20 8 8 0 0 1 0 16h-2a2 2 0 0 0 0 4z" /></>),
  help: s(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></>),
}

export function sectionIcon(key, color = '#64748b') {
  return ICONS[key] ? ICONS[key](color) : null
}

// Groups carry their own icon and label, and a group with a single screen is a
// single row rather than a group of one. That is the automotive portal's shape,
// and the reason its menu reads at a glance where a column of tiny uppercase
// headings does not.
//
// There is deliberately no "AI" group. Grouping four unrelated screens because
// they share a buzzword buries them: Digital Twin is an operations screen and
// AI Vision is a quality one, and nobody looking for either thinks to open a
// folder called AI.
export const MENU = [  {
    key: 'getting-started', label: 'Getting Started', icon: 'getting-started', single: true,
    kw: 'getting started onboarding setup welcome tour first steps adoption home',
  },
  {
    // One module, as the product effectively shows it.
    //
    // The real sidebar carries Dashboard and KPIs as separate entries, but every
    // KPI child is gated on a maritime module — Fleet Owner, Vessel Inspection,
    // Tanker CMMS — so an ordinary CMMS organisation never sees the KPIs group
    // at all and reads Getting Started, Dashboard, Calendar. Two entries here
    // where the product shows one is exactly the difference somebody notices, so
    // the catalogue lives under Dashboard rather than beside it.
    key: 'dash-grp', label: 'Dashboard', icon: 'dashboard',
    children: [
      { key: 'dashboard', label: 'Overview', kw: 'dashboard overview home metrics assets work orders open overdue pm compliance mttr downtime cost inventory value charts trend' },
      { key: 'kpis', label: 'KPIs', kw: 'kpi key performance indicator metric target definition catalogue selection customise scorecard kpis' },
    ],
  },
  {
    // Its own entry, as in the product. It sat at the bottom of an Operations
    // group with the logbooks, which is not where anyone looks for a calendar.
    key: 'calendar', label: 'Calendar', icon: 'calendar', single: true,
    kw: 'calendar schedule planner month week due dates work orders pm maintenance upcoming reminders overview',
  },
  {
    key: 'assets-grp', label: 'Asset', icon: 'assets',
    children: [
      { key: 'assets', label: 'Assets Master', kw: 'assets asset master register equipment machine hierarchy criticality health score serial manufacturer model warranty running hours site location' },
      { key: 'asset-qr', label: 'Assets QR', kw: 'asset qr code label scan tag print sticker mobile lookup nameplate' },
    ],
  },
  {
    // The product's four first, in its order, then the four this build adds.
    // Labour moved here from Inventory because that is where the product puts
    // it — its own menu points Labor at /inventory/labour, so the screen lives
    // with the stores and the entry lives with the work it costs.
    key: 'maint-grp', label: 'Maintenance', icon: 'work-orders',
    children: [
      { key: 'work-orders', label: 'Work Orders', kw: 'work orders wo corrective preventive breakdown open in progress on hold completed overdue priority critical assign technician cost hours' },
      { key: 'requests', label: 'Request Maintenance', kw: 'maintenance request mr raise approve deny convert work order pending review requester' },
      { key: 'pm-schedules', label: 'PM Schedules', kw: 'pm schedules preventive planned maintenance frequency monthly quarterly annual next due compliance meter time based' },
      { key: 'pm-forecast', label: 'PM Forecast', kw: 'pm forecast plan planning workload capacity next 90 days weeks upcoming due projection hours meter run rate crew backlog schedule ahead' },
      { key: 'labour', label: 'Labor', kw: 'labour labor rate hours cost technician time booking timesheet charge' },
      { key: 'my-tasks', label: 'My Tasks', kw: 'my tasks assigned to me today work queue personal inbox due mine technician dashboard' },
      { key: 'approvals', label: 'Approvals', kw: 'approvals approve reject pending queue authorisation sign off work order purchase permit scrap' },
      { key: 'lubrication', label: 'Lubrication', kw: 'lubrication grease oil route lube point interval viscosity condition oil analysis' },
      { key: 'workflow-designer', label: 'Workflow Designer', kw: 'workflow designer automation rule trigger action escalation approval chain builder' },
    ],
  },
  {
    // Five children, five labels, one order — this group already matched the
    // product exactly and is left alone.
    key: 'insp-grp', label: 'Inspection', icon: 'inspections',
    children: [
      { key: 'inspections', label: 'Inspection Reports', kw: 'inspection reports pass fail findings score inspector walk-round pre-start safety condition survey' },
      { key: 'reminder', label: 'Inspection Reminder', kw: 'inspection reminder due recurring notification schedule upcoming' },
      { key: 'incidents', label: 'Incident Reports', kw: 'incident near miss injury spill severity lost time reported investigation ehs safety' },
      { key: 'checklists', label: 'Checklist', kw: 'checklist template items daily walk round pre-start safety compliance completion rate due today' },
      { key: 'rca', label: 'Root Cause Analysis', kw: 'root cause analysis rca five why fishbone ishikawa failure investigation corrective preventive' },
    ],
  },
  {
    // Work Permits is the product's only EHS child and leads, then this build's
    // four.
    key: 'ehs-grp', label: 'EHS', icon: 'ehs',
    children: [
      { key: 'permits', label: 'Work Permits', kw: 'work permit ptw hot work confined space height electrical isolation approval validity ehs' },
      { key: 'ehs', label: 'EHS Dashboard', kw: 'ehs environment health safety dashboard incident rate lost time near miss trir observation' },
      { key: 'certificates', label: 'Certificates', kw: 'certificate statutory examination calibration lifting pressure vessel expiry renewal compliance' },
      { key: 'lototo', label: 'LOTOTO Procedure', kw: 'lototo lockout tagout tryout isolation energy source procedure padlock verification' },
      { key: 'safety-clearances', label: 'Safety Clearances', kw: 'safety clearance line clearance handover isolation confirm sign off return to service' },
    ],
  },
  {
    // The product's own group name for the three logbooks. They were inside a
    // wider "Operations" group with the shutdown screens and the calendar,
    // which is this build's invention rather than the product's.
    key: 'logbook-grp', label: 'Logbook Operations', icon: 'logbook',
    children: [
      { key: 'logbook', label: 'Shift Logbook', kw: 'shift logbook handover entries morning afternoon night breakdown observation safety note operator' },
      { key: 'maintenance-logbook', label: 'Maintenance Logbook', kw: 'maintenance logbook job record work done parts used hours technician sign off' },
      { key: 'logbook-routes', label: 'Logbook Routes', kw: 'logbook route round operator reading parameter tag pass fail progress patrol' },
    ],
  },
  {
    key: 'shutdown-grp', label: 'Shutdown', icon: 'shutdown',
    children: [
      { key: 'shutdown-plans', label: 'Shutdown Plans', kw: 'shutdown plans outage tasks budget progress annual overhaul planned' },
      { key: 'shutdown', label: 'Shutdown Overview', kw: 'shutdown turnaround outage overview readiness progress budget critical path' },
    ],
  },
  {
    key: 'purch-grp', label: 'Purchasing', icon: 'purchase-orders',
    children: [
      { key: 'purchase-orders', label: 'Purchase Orders', kw: 'purchase order po vendor approval draft pending approved received amount line items expected date' },
      { key: 'demand-parts', label: 'Demand Parts', kw: 'demand parts requirement shortage required quantity sourcing ordered work order linked' },
      { key: 'po-approvals', label: 'PO Approvals', kw: 'po approval purchase authorise reject threshold limit approver queue' },
    ],
  },
  {
    key: 'inv-grp', label: 'Inventory', icon: 'parts',
    children: [
      { key: 'parts', label: 'Parts', kw: 'parts spares catalogue part number category unit cost stock on hand minimum reorder storage bin vendor' },
      { key: 'stocks', label: 'Stocks', kw: 'stock levels valuation low out of stock reorder point storage location movement value' },
      { key: 'vendors', label: 'Vendors', kw: 'vendors suppliers contact payment terms lead time orders supplier list' },
      { key: 'scraps', label: 'Scraps', kw: 'scrap write off damaged expired obsolete value approval disposal' },
      { key: 'gate-pass', label: 'Outward Gate Pass', kw: 'gate pass outward returnable non-returnable material out security dispatch repair vendor' },
    ],
  },

  // ── what this build adds ────────────────────────────────────────────────
  //
  // Modules the real Oxmaint sidebar does not show, kept together and placed at
  // the first point where the product's own list can break — after Inventory,
  // before Integrations. Everything above is the product's sidebar in the
  // product's order, and so is everything below.
  //
  // They were interleaved before, each beside whichever product group it was
  // nearest. That reads sensibly one entry at a time and breaks the sequence
  // everywhere: Inspection, EHS, Logbook Operations arrived here as Inspection,
  // AI Vision, EHS, Compliance, Logbook Operations. Somebody who uses Oxmaint
  // reaches for a menu item by position as much as by name, and every insertion
  // moves everything under it.
  //
  // Synapse AI is in this block rather than at the top because the product gates
  // its children on modules an ordinary organisation does not hold, so the group
  // is filtered out of the real sidebar — this build is the only place it shows.
  // The specialised module, if the active pack has one. Both the group and its
  // sections come from the pack: the nav knows that a module can exist, not
  // which one.
  ...(DOMAIN?.sections?.length ? [{
    key: `${DOMAIN.key}-grp`,
    label: DOMAIN.label,
    icon: DOMAIN.icon || DOMAIN.key,
    children: DOMAIN.sections,
  }] : []),
  {
    key: 'synapse-grp', label: 'Synapse AI', icon: 'synapse',
    children: [
      { key: 'synapse', label: 'Cognitive Agent', kw: 'synapse cognitive agent ai assistant llm on-prem question answer maintenance intelligence' },
      { key: 'synapse-p2p', label: 'P-2-P', kw: 'p2p predict to prevent prediction prevention failure forecast risk early warning synapse' },
      { key: 'synapse-tasks', label: 'Tasks', kw: 'synapse tasks agent queue suggested action accept dismiss autonomous' },
      { key: 'synapse-workflow', label: 'Workflow', kw: 'synapse workflow automation chain trigger action agent orchestration' },
    ],
  },
  {
    key: 'ai-auditor', label: 'AI Auditor', icon: 'ai-auditor', single: true,
    kw: 'ai auditor audit data quality gaps missing records duplicate asset hierarchy recommendation cleanup integrity',
  },
  {
    key: 'ai-vision', label: 'AI Vision', icon: 'ai-vision', single: true,
    kw: 'ai vision camera monitor defect detection alert brand model inference edge quality',
  },
  {
    key: 'digital-twin', label: 'Digital Twin', icon: 'digital-twin', single: true,
    kw: 'digital twin monitoring simulation live model sensor telemetry virtual replica tag reading',
  },
  {
    key: 'rcm-reliability', label: 'RCM Reliability', icon: 'rcm-reliability', single: true,
    kw: 'rcm reliability centred maintenance failure mode fmea criticality mtbf rpn strategy analysis',
  },
  {
    key: 'comp-grp', label: 'Compliance', icon: 'compliance',
    children: [
      { key: 'compliance', label: 'Compliance Dashboard', kw: 'compliance dashboard obligation regulation status overdue finding audit readiness' },
      { key: 'audit-trail', label: 'Audit Trail', kw: 'audit trail log who what when change history record immutable traceability' },
      { key: 'capa', label: 'CAPA', kw: 'capa corrective preventive action finding root cause owner due effectiveness closure' },
      { key: 'validation', label: 'Validation', kw: 'validation qualification iq oq pq protocol test evidence approved gxp' },
      { key: 'reviews', label: 'Reviews', kw: 'review periodic management sign off approver cycle document quality' },
      { key: 'vault', label: 'Vault', kw: 'vault document controlled copy retention archive signed record evidence' },
    ],
  },
  {
    key: 'financial', label: 'Financial Management', icon: 'financial', single: true,
    kw: 'financial cost centre budget spend variance capex opex invoice charge back',
  },

  // ── the product's sidebar again, in its own order ────────────────────────
  {
    key: 'integ-grp', label: 'Integrations', icon: 'integrations',
    children: [
      { key: 'integrations', label: 'My Integrations', kw: 'my integrations connected systems pipeline sap quickbooks slack iot power bi dynamics oracle microsoft connector sync records streaming' },
      { key: 'explore-apps', label: 'Explore Apps', kw: 'explore apps marketplace catalogue maximo infor emaint champs micromain mainsaver carl source dimo maint servicenow thermadata migrate import available' },
    ],
  },
  {
    key: 'team-grp', label: 'Team', icon: 'members',
    children: [
      { key: 'members', label: 'Members', kw: 'members users people technicians supervisor planner administrator role trade email access team management' },
      { key: 'teams', label: 'Teams', kw: 'teams crew mechanical electrical instrumentation planning lead members' },
      { key: 'biometrics', label: 'Biometrics Dashboard', kw: 'biometrics attendance shift clock in out presence roster hours worked wrench time' },
    ],
  },
  {
    // Its own group in the product, not a fourth child of Team. Document
    // intelligence reads drawings and certificates for the whole estate; filing
    // it under the people module is where a reader stops looking for it.
    key: 'doc-grp', label: 'Document', icon: 'documents',
    children: [
      { key: 'documents', label: 'Document Intelligence', kw: 'documents manual wiring diagram calibration certificate risk assessment drawing upload attachment intelligence' },
    ],
  },
  {
    key: 'org-grp', label: 'Organization', icon: 'organization',
    children: [
      { key: 'organization', label: 'Details', kw: 'organization details company name industry address country timezone currency logo branding' },
      { key: 'reports', label: 'Reports', kw: 'reports analytics export cost downtime backlog compliance pareto trend monthly organization' },
      { key: 'settings', label: 'Settings', kw: 'settings configurations preferences date format time currency measurement week start notifications module visibility' },
      { key: 'locations', label: 'Locations & Sites', kw: 'locations sites functional location hierarchy plant depot works city asset count' },
      { key: 'subscription', label: 'Subscription', kw: 'subscription plan enterprise seats users billing renewal expiry licence' },
      { key: 'white-label', label: 'White Label', kw: 'white label branding logo colour custom domain theme partner reseller' },
    ],
  },
  {
    key: 'partner-grp', label: 'Partner Hub', icon: 'partner-hub',
    children: [
      { key: 'partner-client', label: 'Client', kw: 'partner client customer contract sla shared portal external account' },
      { key: 'partner-vendor', label: 'Vendor', kw: 'partner vendor supplier contract sla shared portal external service provider' },
      { key: 'partner-billing', label: 'Billing', kw: 'partner billing spend invoice charge contract value by partner' },
    ],
  },
  {
    key: 'help-grp', label: 'Help & Support', icon: 'help',
    children: [
      { key: 'help', label: 'Resources', kw: 'help resources guides documentation manual video walkthrough support library' },
      { key: 'help-ticket', label: 'Raise a Ticket', kw: 'raise ticket support request issue bug report response target sla' },
      { key: 'help-contact', label: 'Contact Us', kw: 'contact us support email phone address office reach' },
      { key: 'help-faq', label: 'FAQ', kw: 'faq frequently asked questions answers common help' },
      { key: 'help-terms', label: 'Terms of Service', kw: 'terms of service agreement legal conditions licence' },
      { key: 'help-privacy', label: 'Privacy Policy', kw: 'privacy policy data protection gdpr retention personal information' },
    ],
  },
]

// Flat list for the command-palette search.
export const SECTIONS = MENU.flatMap((g) => (
  g.single
    ? [{ key: g.key, label: g.label, group: g.label, kw: g.kw || '' }]
    : g.children.map((c) => ({ key: c.key, label: c.label, group: g.label, kw: c.kw || '' }))
))

export const SECTION_LABEL = Object.fromEntries(SECTIONS.map((x) => [x.key, x.label]))
