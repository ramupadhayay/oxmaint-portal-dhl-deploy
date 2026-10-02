'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// Code-split per section, the way the CMMS portal does it: navigating downloads
// only that screen's JS rather than putting the whole portal in the first chunk
// and making the landing page pay for screens nobody opened.
function Fallback() {
  const bar = {
    background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)',
    backgroundSize: '400% 100%', animation: 'hospShim 1.1s ease-in-out infinite', borderRadius: 10,
  }
  return (
    <div>
      <style>{'@keyframes hospShim{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
      <div style={{ ...bar, height: 22, width: '30%', marginBottom: 10 }} />
      <div style={{ ...bar, height: 13, width: '50%', marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ ...bar, height: 74 }} />)}
      </div>
      <div style={{ ...bar, height: 300 }} />
    </div>
  )
}

const load = (fn) => dynamic(fn, { loading: Fallback })

const P = {
  overview: load(() => import('@/components/industries/hospitality/pages/Overview')),

  dailySchedule: load(() => import('@/components/industries/hospitality/pages/DailySchedule')),
  suiteRotation: load(() => import('@/components/industries/hospitality/pages/SuiteRotation')),
  myTasks: load(() => import('@/components/industries/hospitality/pages/MyTasks')),
  calendar: load(() => import('@/components/industries/hospitality/pages/Calendar')),

  suites: load(() => import('@/components/industries/hospitality/pages/Suites')),
  assets: load(() => import('@/components/industries/hospitality/pages/Assets')),
  assetQr: load(() => import('@/components/industries/hospitality/pages/AssetQR')),
  locations: load(() => import('@/components/industries/hospitality/pages/Locations')),

  workOrders: load(() => import('@/components/industries/hospitality/pages/WorkOrders')),
  requests: load(() => import('@/components/industries/hospitality/pages/Requests')),
  pmSchedules: load(() => import('@/components/industries/hospitality/pages/PMSchedules')),
  checklists: load(() => import('@/components/industries/hospitality/pages/Checklists')),

  compliance: load(() => import('@/components/industries/hospitality/pages/Compliance')),
  inspections: load(() => import('@/components/industries/hospitality/pages/Inspections')),
  incidents: load(() => import('@/components/industries/hospitality/pages/Incidents')),

  kpis: load(() => import('@/components/industries/hospitality/pages/Kpis')),
  reports: load(() => import('@/components/industries/hospitality/pages/Reports')),

  parts: load(() => import('@/components/industries/hospitality/pages/Parts')),
  vendors: load(() => import('@/components/industries/hospitality/pages/Vendors')),

  teams: load(() => import('@/components/industries/hospitality/pages/Teams')),
  // The community association side. Grouped together here the way they are
  // grouped in the menu.
  commonAreas: load(() => import('@/components/industries/hospitality/pages/CommonAreas')),
  reserve: load(() => import('@/components/industries/hospitality/pages/ReservePlanning')),
  vendorPm: load(() => import('@/components/industries/hospitality/pages/VendorPm')),

  settings: load(() => import('@/components/industries/hospitality/pages/Settings')),
}

// Every key quoted, including the ones JavaScript would accept bare.
//
// Not a style preference: scripts/check-portals.mjs discovers a portal's
// sections by reading this object, and it matches quoted keys. Written bare,
// seven of these were invisible to it — the check reported four sections and
// then said "all screens rendered", which is worse than not running it.

const SECTION_MAP = {
  'overview': P.overview,

  'daily-schedule': P.dailySchedule,
  'suite-rotation': P.suiteRotation,
  'my-tasks': P.myTasks,
  'calendar': P.calendar,

  'suites': P.suites,
  'assets': P.assets,
  'asset-qr': P.assetQr,
  'locations': P.locations,

  'work-orders': P.workOrders,
  'requests': P.requests,
  'pm-schedules': P.pmSchedules,
  'checklists': P.checklists,

  'compliance': P.compliance,
  'inspections': P.inspections,
  'incidents': P.incidents,

  'kpis': P.kpis,
  'reports': P.reports,

  'parts': P.parts,
  'vendors': P.vendors,

  'teams': P.teams,
  'common-areas': P.commonAreas,
  'reserve': P.reserve,
  'vendor-pm': P.vendorPm,

  'settings': P.settings,
}

export default function HospitalitySection() {
  const { section } = useParams()
  const Page = SECTION_MAP[section] || SECTION_MAP.overview
  return <Page section={section} />
}
