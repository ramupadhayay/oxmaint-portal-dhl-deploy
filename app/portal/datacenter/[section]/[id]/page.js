'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// One route for every record page in the portal: /portal/datacenter/<section>/<id>.
//
// The alternative — a folder per register — would be twenty near-identical
// route files whose only difference is which config they read, and the configs
// already say that. A section with something more to show than its fields gets
// its own component here; everything else falls through to the generic record
// page, which reads the same config the list screen does.

const load = (fn) => dynamic(fn, { loading: () => <Skeleton /> })

function Skeleton() {
  const bar = { background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)', backgroundSize: '400% 100%', animation: 'dcShim 1.1s ease-in-out infinite', borderRadius: 10 }
  return (
    <div>
      <style>{`@keyframes dcShim{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
      <div style={{ ...bar, height: 28, width: 180, marginBottom: 14 }} />
      <div style={{ ...bar, height: 26, width: '45%', marginBottom: 8 }} />
      <div style={{ ...bar, height: 14, width: '30%', marginBottom: 20 }} />
      <div style={{ ...bar, height: 260 }} />
    </div>
  )
}

const AlertView = load(() => import('@/components/industries/datacenter/pages/AlertView'))
const RecordView = load(() => import('@/components/industries/datacenter/pages/RecordView'))
const WorkOrderView = load(() => import('@/components/industries/datacenter/pages/WorkOrderView'))
const WorkOrderCreate = load(() => import('@/components/industries/datacenter/pages/WorkOrderCreate'))

const AssetMonitor = load(() => import('@/components/industries/datacenter/pages/AssetMonitor'))
const InspectionView = load(() => import('@/components/industries/datacenter/pages/InspectionView'))
const InspectionCreate = load(() => import('@/components/industries/datacenter/pages/InspectionCreate'))
const ChecklistCreate = load(() => import('@/components/industries/datacenter/pages/ChecklistCreate'))
const DetectionView = load(() =>
  import('@/components/industries/datacenter/pages/Detections').then((m) => ({ default: m.DetectionView })))
const IncidentView = load(() => import('@/components/industries/datacenter/pages/IncidentView'))
const ReminderView = load(() => import('@/components/industries/datacenter/pages/ReminderView'))
const ChecklistView = load(() => import('@/components/industries/datacenter/pages/ChecklistView'))
const ComputeNodeView = load(() => import('@/components/industries/datacenter/pages/ComputeNodeView'))
const PmComplianceView = load(() => import('@/components/industries/datacenter/pages/PmComplianceView'))

const SPECIAL = {
  // A compute node's page is its own device drill-down (GPUs, drives, PSUs,
  // predictive), not a generic record — the fleet table has no static config.
  'compute-telemetry': ComputeNodeView,
  // A completed PM is a maintenance record — the checklist worked, the readings
  // taken, the variance and next-due — not the four-field log line.
  'pm-compliance': PmComplianceView,
  alerts: AlertView,
  'work-orders': WorkOrderView,
  monitoring: AssetMonitor,
  detections: DetectionView,
  // Two kinds of row land on an inspection's page — the generated ones and the
  // ones raised in the portal — and only the first is in a static list, so the
  // generic record page cannot find the second.
  'inspection-reports': InspectionView,
  // An incident only means something next to the other six — most cost no
  // downtime because the redundancy held, and a page showing one row cannot
  // say that. The config's fields stay for the list screen.
  incidents: IncidentView,
  // A reminder is a decision, not a row: the last result, the health score the
  // sensors are reporting now, and whether the site's redundancy lets the
  // machine come offline all bear on it, and they sit in different sheets. The
  // config's fields stay for the list screen.
  'inspection-reminder': ReminderView,
  // The builder writes an instruction, a unit, an acceptable band and three
  // capture requirements against every item. The library card shows none of
  // them, so a checklist needs a page of its own to be checkable at all.
  checklists: ChecklistView,
}

// `new` is the one id that is not an id. The product this follows puts create
// on its own sub-route rather than a query flag, and a record page asked for a
// record called "new" would otherwise render "nothing here with that
// reference" — which is what a user typing the URL would get.
const CREATE = {
  'work-orders': WorkOrderCreate,
  'inspection-reports': InspectionCreate,
  checklists: ChecklistCreate,
}

export default function DataCenterRecord() {
  const { section, id } = useParams()

  if (id === 'new') {
    const Create = CREATE[section]
    if (Create) return <Create />
  }

  const Page = SPECIAL[section] || RecordView
  return <Page />
}
