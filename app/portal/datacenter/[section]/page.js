'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// Code-split per section, for the same reason as the CMMS portal: the overview
// is where everyone lands, and it should not carry the twenty screens nobody
// opened in its first chunk.
//
// Every import path below is written out in full. A bundler resolves dynamic
// imports statically, so a path built from a variable — even a constant one —
// leaves it nothing to follow and the chunk is never emitted.
function Fallback() {
  const bar = { background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)', backgroundSize: '400% 100%', animation: 'dcShim 1.1s ease-in-out infinite', borderRadius: 10 }
  return (
    <div>
      <style>{`@keyframes dcShim{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
      <div style={{ ...bar, height: 22, width: '30%', marginBottom: 10 }} />
      <div style={{ ...bar, height: 13, width: '52%', marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ ...bar, height: 74 }} />)}
      </div>
      <div style={{ ...bar, height: 300 }} />
    </div>
  )
}

const load = (fn) => dynamic(fn, { loading: Fallback })

// The registers all live in one module, so they share one chunk. That is the
// right trade here: they are small column definitions over data the portal has
// already loaded, and twenty separate requests to render a table would cost
// more than the module does.
const reg = (name) => load(() =>
  import('@/components/industries/datacenter/pages/registers').then((m) => ({ default: m[name] })))

// The four Inspection screens share a module for the same reason the registers
// do: they are one layout with four sets of fields.
const insp = (name) => load(() =>
  import('@/components/industries/datacenter/pages/inspection').then((m) => ({ default: m[name] })))

const SECTION_MAP = {
  'overview': load(() => import('@/components/industries/datacenter/pages/Overview')),

  // Power & Capacity — ported from the electrical portal on the iFactory platform.
  'power-architecture': load(() => import('@/components/industries/datacenter/pages/PowerArchitecture')),
  'dcim-floor': load(() => import('@/components/industries/datacenter/pages/DcimFloor')),
  'gpu-power': load(() => import('@/components/industries/datacenter/pages/GpuClusterPower')),
  'compute-telemetry': load(() => import('@/components/industries/datacenter/pages/ComputeTelemetry')),
  'capacity-planner': load(() => import('@/components/industries/datacenter/pages/CapacityPlanner')),
  'ups-health': load(() => import('@/components/industries/datacenter/pages/UpsHealth')),
  'kpis': load(() => import('@/components/industries/datacenter/pages/Kpis')),
  'alerts': load(() => import('@/components/industries/datacenter/pages/Alerts')),
  'trend': load(() => import('@/components/industries/datacenter/pages/Trend')),
  'monitoring': load(() => import('@/components/industries/datacenter/pages/AssetCondition')),
  // The architecture splits asset health into a power domain and a mechanical
  // one over the same readings, so both open the same screen and it reads the
  // section key to know which slice of the estate it is showing.
  'power-health': load(() => import('@/components/industries/datacenter/pages/AssetCondition')),
  'mechanical-health': load(() => import('@/components/industries/datacenter/pages/AssetCondition')),
  'detections': load(() => import('@/components/industries/datacenter/pages/Detections')),
  'recommendations': load(() => import('@/components/industries/datacenter/pages/Recommendations')),
  'reports': load(() => import('@/components/industries/datacenter/pages/Reports')),
  'teams': load(() => import('@/components/industries/datacenter/pages/Teams')),
  'documents': load(() => import('@/components/industries/datacenter/pages/Documents')),
  'outcomes': load(() => import('@/components/industries/datacenter/pages/Outcomes')),
  'notifications': load(() => import('@/components/industries/datacenter/pages/Notifications')),
  'work-orders': load(() => import('@/components/industries/datacenter/pages/WorkOrders')),
  'asset-qr': load(() => import('@/components/industries/datacenter/pages/AssetQR')),
  'go-no-go': load(() => import('@/components/industries/datacenter/pages/GoNoGo')),

  // The product's own Asset and Inspection modules. These are card screens
  // rather than registers, so they are their own components — the register
  // configs behind them exist only for their record pages.
  'assets': load(() => import('@/components/industries/datacenter/pages/AssetMaster')),
  'inspection-reports': insp('InspectionReports'),
  'inspection-reminder': insp('InspectionReminder'),
  'incidents': insp('IncidentReports'),
  'checklists': insp('Checklist'),

  'weekly-health': reg('WeeklyHealth'),
  'benefits': reg('Benefits'),

  'sites': reg('Sites'),
  'locations': reg('Locations'),
  'asset-classes': reg('AssetClasses'),

  'readings': reg('Readings'),
  'correlation': load(() => import('@/components/industries/datacenter/pages/Correlation')),

  'systems': load(() => import('@/components/industries/datacenter/pages/Systems')),
  'bms': reg('Bms'),
  'epms': reg('Epms'),
  'dcim': reg('Dcim'),
  'oem': reg('Oem'),
  'battery': load(() => import('@/components/industries/datacenter/pages/Battery')),

  'pm-tasks': reg('PmTasks'),
  'pm-calendar': load(() => import('@/components/industries/datacenter/pages/PmCalendar')),
  'pm-compliance': reg('PmCompliance'),

  'risks': reg('Risks'),
  'site-readiness': reg('SiteReadiness'),
  'tech-prereq': reg('TechPrereq'),
  'stakeholders': reg('Stakeholders'),

  'failure-codes': reg('FailureCodes'),
  'criticality': reg('Criticality'),
  'manufacturers': reg('Manufacturers'),
}

export default function DataCenterSection() {
  const { section } = useParams()
  const Page = SECTION_MAP[section] || SECTION_MAP.overview
  return <Page section={section} />
}
