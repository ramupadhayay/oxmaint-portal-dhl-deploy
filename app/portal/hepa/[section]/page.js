'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// Code-split per section, the way the other portals do it: navigating downloads
// only that screen's JS rather than putting the whole portal in the first chunk
// and making the landing page pay for screens nobody opened.
function Fallback() {
  const bar = {
    background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)',
    backgroundSize: '400% 100%', animation: 'hepaShim 1.1s ease-in-out infinite', borderRadius: 10,
  }
  return (
    <div>
      <style>{'@keyframes hepaShim{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
      <div style={{ ...bar, height: 30, width: '34%', marginBottom: 9 }} />
      <div style={{ ...bar, height: 14, width: '52%', marginBottom: 22 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ ...bar, height: 74 }} />)}
      </div>
      <div style={{ ...bar, height: 300 }} />
    </div>
  )
}

const load = (fn) => dynamic(fn, { loading: Fallback })

const P = {
  overview: load(() => import('@/components/industries/hepa/pages/Overview')),

  workOrders: load(() => import('@/components/industries/hepa/pages/WorkOrders')),
  pmSchedules: load(() => import('@/components/industries/hepa/pages/PmSchedules')),
  requests: load(() => import('@/components/industries/hepa/pages/Requests')),
  checklists: load(() => import('@/components/industries/hepa/pages/Checklists')),

  inspections: load(() => import('@/components/industries/hepa/pages/Inspections')),
  inspectionReminder: load(() => import('@/components/industries/hepa/pages/InspectionReminder')),
  incidents: load(() => import('@/components/industries/hepa/pages/Incidents')),

  cleanrooms: load(() => import('@/components/industries/hepa/pages/Cleanrooms')),
  technicians: load(() => import('@/components/industries/hepa/pages/Technicians')),

  filters: load(() => import('@/components/industries/hepa/pages/Filters')),
  tests: load(() => import('@/components/industries/hepa/pages/Tests')),
  leaks: load(() => import('@/components/industries/hepa/pages/Leaks')),
  replacements: load(() => import('@/components/industries/hepa/pages/Replacements')),

  repository: load(() => import('@/components/industries/hepa/pages/Repository')),
  retention: load(() => import('@/components/industries/hepa/pages/Retention')),
  auditExport: load(() => import('@/components/industries/hepa/pages/AuditExport')),

  lifecycle: load(() => import('@/components/industries/hepa/pages/Lifecycle')),
  approvals: load(() => import('@/components/industries/hepa/pages/Approvals')),
  notifications: load(() => import('@/components/industries/hepa/pages/Notifications')),

  sapAssets: load(() => import('@/components/industries/hepa/pages/SapAssets')),
  sapSync: load(() => import('@/components/industries/hepa/pages/SapSync')),

  routing: load(() => import('@/components/industries/hepa/pages/Routing')),
  access: load(() => import('@/components/industries/hepa/pages/Access')),
  reports: load(() => import('@/components/industries/hepa/pages/Reports')),
  settings: load(() => import('@/components/industries/hepa/pages/Settings')),
}

// Every key quoted, including the ones JavaScript would accept bare.
//
// Not a style preference: scripts/check-portals.mjs discovers a portal's
// sections by reading this object and it matches quoted keys. Written bare, a
// section is invisible to the check, which then reports a smaller number and
// says "all screens rendered" — a pass that covered part of the portal, which
// is worse than not running it.
const SECTION_MAP = {
  'overview': P.overview,

  'work-orders': P.workOrders,
  'pm-schedules': P.pmSchedules,
  'requests': P.requests,
  'checklists': P.checklists,

  'inspections': P.inspections,
  'inspection-reminder': P.inspectionReminder,
  'incidents': P.incidents,

  'cleanrooms': P.cleanrooms,
  'filters': P.filters,
  'tests': P.tests,
  'leaks': P.leaks,
  'replacements': P.replacements,
  'technicians': P.technicians,

  'repository': P.repository,
  'retention': P.retention,
  'audit-export': P.auditExport,

  'lifecycle': P.lifecycle,
  'approvals': P.approvals,
  'notifications': P.notifications,
  'routing': P.routing,

  'sap-assets': P.sapAssets,
  'sap-sync': P.sapSync,

  'access': P.access,
  'reports': P.reports,
  'settings': P.settings,
}

export default function HepaSection() {
  const { section } = useParams()
  const Page = SECTION_MAP[section] || SECTION_MAP.overview
  return <Page section={section} />
}
