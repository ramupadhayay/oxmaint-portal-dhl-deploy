'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { SECTION_SLUGS } from './sections'

// Each section is code-split, so navigating downloads only that screen's JS.
// With sixty sections in one portal, importing them eagerly would put the whole
// CMMS in the first chunk and make the dashboard — the page everyone lands on —
// pay for pages nobody opened.
function Fallback() {
  const bar = { background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)', backgroundSize: '400% 100%', animation: 'oxShim 1.1s ease-in-out infinite', borderRadius: 10 }
  return (
    <div>
      <style>{`@keyframes oxShim{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
      <div style={{ ...bar, height: 22, width: '30%', marginBottom: 10 }} />
      <div style={{ ...bar, height: 13, width: '50%', marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ ...bar, height: 74 }} />)}
      </div>
      <div style={{ ...bar, height: 300 }} />
    </div>
  )
}

// ssr: false — the screens are rendered in the browser only.
//
// Every register here is dated relative to "now" (lib/data.js EPOCH), so HTML
// rendered on the server and HTML rendered in the browser disagree the moment
// the two clocks differ — a different day, or simply a different time zone.
// React then throws the server's markup away and re-renders the whole page
// (hydration error #418), which is slower than never having sent it.
//
// So the page ships as the skeleton below, straight from the CDN's cache, and
// the screen paints on the client. The demo clock keeps moving with the calendar,
// which is what makes the dataset read as current a month after a build.
const load = (fn) => dynamic(fn, { loading: Fallback, ssr: false })

// Two modules — Compliance and EHS — put several menu entries behind tabs of one
// page, because their six and five screens share a dataset and splitting them
// into separate routes would mean reloading it on every tab. Those entries all
// resolve to the same component and it opens on the right tab from `section`.
const P = {
  gettingStarted: load(() => import('@/components/industries/oxmaint/pages/GettingStarted')),
  dashboard: load(() => import('@/components/industries/oxmaint/pages/Dashboard')),
  kpis: load(() => import('@/components/industries/oxmaint/pages/Kpis')),
  reports: load(() => import('@/components/industries/oxmaint/pages/Reports')),

  aiAuditor: load(() => import('@/components/industries/oxmaint/pages/AiAuditor')),

  // The active pack's specialised module. The menu only offers these when the
  // pack defines one, but the routes exist either way — a deep link into a
  // module the demo does not have should land on a page that says so, not 404.
  chillerOverview: load(() => import('@/components/industries/oxmaint/pages/ChillerOverview')),
  chillerMonitor: load(() => import('@/components/industries/oxmaint/pages/ChillerMonitor')),
  leakDetection: load(() => import('@/components/industries/oxmaint/pages/LeakDetection')),
  chillerEfficiency: load(() => import('@/components/industries/oxmaint/pages/ChillerEfficiency')),
  chillerSolution: load(() => import('@/components/industries/oxmaint/pages/ChillerSolution')),

  // The GSE fleet module, supplied by the DHL pack. Like the chiller screens,
  // the routes exist whatever pack is loaded — a deep link into a module this
  // demo does not have lands on a page that says so rather than a 404.
  gseReadiness: load(() => import('@/components/industries/oxmaint/pages/GseReadiness')),
  gseMeters: load(() => import('@/components/industries/oxmaint/pages/GseMeters')),
  gseBattery: load(() => import('@/components/industries/oxmaint/pages/GseBattery')),
  gseSeasonal: load(() => import('@/components/industries/oxmaint/pages/GseSeasonal')),
  gseRfp: load(() => import('@/components/industries/oxmaint/pages/GseRfp')),
  gseVoice: load(() => import('@/components/industries/oxmaint/pages/GseVoice')),
  gseWaterfall: load(() => import('@/components/industries/oxmaint/pages/GseWaterfall')),
  pmForecast: load(() => import('@/components/industries/oxmaint/pages/PmForecast')),
  gseStores: load(() => import('@/components/industries/oxmaint/pages/GseStores')),
  gseReliability: load(() => import('@/components/industries/oxmaint/pages/GseReliability')),
  gseWorkmanship: load(() => import('@/components/industries/oxmaint/pages/GseWorkmanship')),
  gseSap: load(() => import('@/components/industries/oxmaint/pages/GseSap')),
  gseNextFive: load(() => import('@/components/industries/oxmaint/pages/GseNextFive')),
  gseFiveYear: load(() => import('@/components/industries/oxmaint/pages/GseFiveYear')),
  gseWarranty: load(() => import('@/components/industries/oxmaint/pages/GseWarranty')),
  gsePartsKits: load(() => import('@/components/industries/oxmaint/pages/GsePartsKits')),
  gseSpareInsights: load(() => import('@/components/industries/oxmaint/pages/GseSpareInsights')),
  gseAuditReport: load(() => import('@/components/industries/oxmaint/pages/GseAuditReport')),
  gseCycleCounts: load(() => import('@/components/industries/oxmaint/pages/GseCycleCounts')),
  gseTechKpi: load(() => import('@/components/industries/oxmaint/pages/GseTechKpi')),

  // The hospital life safety module. Same rule as the GSE one: the routes are
  // there for every pack and explain themselves where the pack has no module.
  flsCompliance: load(() => import('@/components/industries/oxmaint/pages/FlsCompliance')),
  flsSurvey: load(() => import('@/components/industries/oxmaint/pages/FlsSurvey')),
  flsEvidence: load(() => import('@/components/industries/oxmaint/pages/FlsEvidence')),
  flsIlsm: load(() => import('@/components/industries/oxmaint/pages/FlsIlsm')),
  flsSoc: load(() => import('@/components/industries/oxmaint/pages/FlsSoc')),
  synapse: load(() => import('@/components/industries/oxmaint/pages/Synapse')),
  aiVision: load(() => import('@/components/industries/oxmaint/pages/AiVision')),
  digitalTwin: load(() => import('@/components/industries/oxmaint/pages/DigitalTwin')),

  assets: load(() => import('@/components/industries/oxmaint/pages/AssetMaster')),
  assetQr: load(() => import('@/components/industries/oxmaint/pages/AssetQR')),

  myTasks: load(() => import('@/components/industries/oxmaint/pages/MyTasks')),
  workOrders: load(() => import('@/components/industries/oxmaint/pages/WorkOrders')),
  workOrderCreate: load(() => import('@/components/industries/oxmaint/pages/WorkOrderCreate')),
  checklistCreate: load(() => import('@/components/industries/oxmaint/pages/ChecklistCreate')),
  inspectionCreate: load(() => import('@/components/industries/oxmaint/pages/InspectionCreate')),
  pmScheduleCreate: load(() => import('@/components/industries/oxmaint/pages/PmScheduleCreate')),
  requests: load(() => import('@/components/industries/oxmaint/pages/Requests')),
  // PmSchedules, not PMSchedules. Windows resolved the wrong case for as long as
  // the module stayed cached; the first edit to that file turned it into a build
  // error, and it would have been one on any case-sensitive machine all along.
  pmSchedules: load(() => import('@/components/industries/oxmaint/pages/PmSchedules')),
  approvals: load(() => import('@/components/industries/oxmaint/pages/Approvals')),
  lubrication: load(() => import('@/components/industries/oxmaint/pages/Lubrication')),
  workflowDesigner: load(() => import('@/components/industries/oxmaint/pages/WorkflowDesigner')),
  rcm: load(() => import('@/components/industries/oxmaint/pages/Rcm')),

  inspections: load(() => import('@/components/industries/oxmaint/pages/Inspections')),
  inspectionReminder: load(() => import('@/components/industries/oxmaint/pages/InspectionReminder')),
  incidents: load(() => import('@/components/industries/oxmaint/pages/Incidents')),
  checklists: load(() => import('@/components/industries/oxmaint/pages/Checklists')),
  rca: load(() => import('@/components/industries/oxmaint/pages/Rca')),

  shutdown: load(() => import('@/components/industries/oxmaint/pages/Shutdown')),
  logbook: load(() => import('@/components/industries/oxmaint/pages/ShiftLogbook')),
  maintenanceLogbook: load(() => import('@/components/industries/oxmaint/pages/MaintenanceLogbook')),
  logbookRoutes: load(() => import('@/components/industries/oxmaint/pages/LogbookRoutes')),
  calendar: load(() => import('@/components/industries/oxmaint/pages/Calendar')),

  parts: load(() => import('@/components/industries/oxmaint/pages/Parts')),
  stocks: load(() => import('@/components/industries/oxmaint/pages/Stocks')),
  vendors: load(() => import('@/components/industries/oxmaint/pages/Vendors')),
  scraps: load(() => import('@/components/industries/oxmaint/pages/Scraps')),
  labour: load(() => import('@/components/industries/oxmaint/pages/Labour')),
  gatePass: load(() => import('@/components/industries/oxmaint/pages/GatePass')),

  purchaseOrders: load(() => import('@/components/industries/oxmaint/pages/PurchaseOrders')),
  poApprovals: load(() => import('@/components/industries/oxmaint/pages/PoApprovals')),
  demandParts: load(() => import('@/components/industries/oxmaint/pages/DemandParts')),

  ehs: load(() => import('@/components/industries/oxmaint/pages/Ehs')),
  permits: load(() => import('@/components/industries/oxmaint/pages/WorkPermits')),
  compliance: load(() => import('@/components/industries/oxmaint/pages/Compliance')),

  members: load(() => import('@/components/industries/oxmaint/pages/Members')),
  teams: load(() => import('@/components/industries/oxmaint/pages/Teams')),
  biometrics: load(() => import('@/components/industries/oxmaint/pages/Biometrics')),
  documents: load(() => import('@/components/industries/oxmaint/pages/Documents')),

  partnerHub: load(() => import('@/components/industries/oxmaint/pages/PartnerHub')),
  exploreApps: load(() => import('@/components/industries/oxmaint/pages/ExploreApps')),
  financial: load(() => import('@/components/industries/oxmaint/pages/Financial')),
  integrations: load(() => import('@/components/industries/oxmaint/pages/Integrations')),

  organization: load(() => import('@/components/industries/oxmaint/pages/Organization')),
  locations: load(() => import('@/components/industries/oxmaint/pages/Locations')),
  subscription: load(() => import('@/components/industries/oxmaint/pages/Subscription')),
  whiteLabel: load(() => import('@/components/industries/oxmaint/pages/WhiteLabel')),
  settings: load(() => import('@/components/industries/oxmaint/pages/Settings')),
  help: load(() => import('@/components/industries/oxmaint/pages/Help')),
}

const SECTION_MAP = {
  'getting-started': P.gettingStarted,
  'dashboard': P.dashboard,
  'kpis': P.kpis,
  'reports': P.reports,

  'ai-auditor': P.aiAuditor,

  'chiller-overview': P.chillerOverview,
  'chiller-monitor': P.chillerMonitor,
  'leak-detection': P.leakDetection,
  'chiller-efficiency': P.chillerEfficiency,
  'chiller-solution': P.chillerSolution,

  'gse-readiness': P.gseReadiness,
  'gse-meters': P.gseMeters,
  'gse-battery': P.gseBattery,
  'gse-seasonal': P.gseSeasonal,
  'gse-rfp': P.gseRfp,
  'gse-voice': P.gseVoice,
  'gse-waterfall': P.gseWaterfall,
  'pm-forecast': P.pmForecast,
  'gse-stores': P.gseStores,
  'gse-reliability': P.gseReliability,
  'gse-workmanship': P.gseWorkmanship,
  'gse-sap': P.gseSap,
  'gse-next-five': P.gseNextFive,
  'gse-five-year': P.gseFiveYear,
  'gse-warranty': P.gseWarranty,
  'gse-parts-kits': P.gsePartsKits,
  'gse-spare-insights': P.gseSpareInsights,
  'gse-audit-report': P.gseAuditReport,
  'gse-cycle-counts': P.gseCycleCounts,
  'gse-tech-kpi': P.gseTechKpi,

  'fls-evidence': P.flsEvidence,
  'fls-compliance': P.flsCompliance,
  'fls-ilsm': P.flsIlsm,
  'fls-soc': P.flsSoc,
  'fls-survey': P.flsSurvey,
  'synapse': P.synapse,
  'synapse-p2p': P.synapse,
  'synapse-tasks': P.synapse,
  'synapse-workflow': P.synapse,
  'ai-vision': P.aiVision,
  'digital-twin': P.digitalTwin,

  'assets': P.assets,
  'asset-qr': P.assetQr,

  'my-tasks': P.myTasks,
  'work-orders': P.workOrders,
  'work-orders-create': P.workOrderCreate,
  'checklists-create': P.checklistCreate,
  'inspections-create': P.inspectionCreate,
  'pm-schedules-create': P.pmScheduleCreate,
  'requests': P.requests,
  'pm-schedules': P.pmSchedules,
  'approvals': P.approvals,
  'lubrication': P.lubrication,
  'workflow-designer': P.workflowDesigner,
  'rcm-reliability': P.rcm,

  'inspections': P.inspections,
  'reminder': P.inspectionReminder,
  'incidents': P.incidents,
  'checklists': P.checklists,
  'rca': P.rca,

  'shutdown': P.shutdown,
  'shutdown-plans': P.shutdown,
  'logbook': P.logbook,
  'maintenance-logbook': P.maintenanceLogbook,
  'logbook-routes': P.logbookRoutes,
  'calendar': P.calendar,

  'parts': P.parts,
  'stocks': P.stocks,
  'vendors': P.vendors,
  'scraps': P.scraps,
  'labour': P.labour,
  'gate-pass': P.gatePass,

  'purchase-orders': P.purchaseOrders,
  'po-approvals': P.poApprovals,
  'demand-parts': P.demandParts,

  'ehs': P.ehs,
  'certificates': P.ehs,
  'lototo': P.ehs,
  'safety-clearances': P.ehs,
  'permits': P.permits,

  'compliance': P.compliance,
  'audit-trail': P.compliance,
  'capa': P.compliance,
  'validation': P.compliance,
  'reviews': P.compliance,
  'vault': P.compliance,

  'members': P.members,
  'teams': P.teams,
  'biometrics': P.biometrics,
  'documents': P.documents,

  // The product gives each of these sub-modules its own route. Behind them is
  // one screen whose tabs were already those sub-modules, so the entries share
  // a component and it opens on the tab the section names.
  'partner-hub': P.partnerHub,
  'partner-client': P.partnerHub,
  'partner-vendor': P.partnerHub,
  'partner-billing': P.partnerHub,
  'financial': P.financial,
  'integrations': P.integrations,
  'explore-apps': P.exploreApps,

  'organization': P.organization,
  'locations': P.locations,
  'subscription': P.subscription,
  'white-label': P.whiteLabel,
  'settings': P.settings,
  'help': P.help,
  'help-ticket': P.help,
  'help-contact': P.help,
  'help-faq': P.help,
  'help-terms': P.help,
  'help-privacy': P.help,
}

// Development guard: a section added to the map but not to sections.js still
// works, it just misses the prerender, and this is where that gets noticed.
if (process.env.NODE_ENV === 'development') {
  const missing = Object.keys(SECTION_MAP).filter((s) => !SECTION_SLUGS.includes(s))
  if (missing.length) console.warn('[portal] sections not prerendered (add to sections.js):', missing.join(', '))
}

export default function OxmaintSection() {
  const { section } = useParams()
  const Page = SECTION_MAP[section] || SECTION_MAP.dashboard
  // Passed to every page; the tabbed ones read it to open on the right tab and
  // the rest ignore it.
  return <Page section={section} />
}
