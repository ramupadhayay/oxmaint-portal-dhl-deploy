'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// One route for every record page in the portal: /portal/hepa/<section>/<id>.
//
// Same shape as the FSM and hospitality portals, for the same reason: the
// alternative is half a dozen near-identical route files whose only difference
// is which component they load.
//
// These are pages rather than drawers. A filter's record carries its whole test
// history, its leak readings, its replacements, its SAP mapping and its
// certification document — a panel sliding over the table is the wrong shape
// for that, and it cannot be linked to, opened in a second tab, or closed with
// the back button.

const load = (fn) => dynamic(fn, { loading: () => <Skeleton /> })

function Skeleton() {
  const bar = {
    background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)',
    backgroundSize: '400% 100%', animation: 'hepaShim 1.1s ease-in-out infinite', borderRadius: 10,
  }
  return (
    <div>
      <style>{'@keyframes hepaShim{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
      <div style={{ ...bar, height: 26, width: 150, marginBottom: 14 }} />
      <div style={{ ...bar, height: 30, width: '40%', marginBottom: 8 }} />
      <div style={{ ...bar, height: 14, width: '28%', marginBottom: 22 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ ...bar, height: 74 }} />)}
      </div>
      <div style={{ ...bar, height: 280 }} />
    </div>
  )
}

const FilterView = load(() => import('@/components/industries/hepa/pages/FilterView'))
const TestView = load(() => import('@/components/industries/hepa/pages/TestView'))
const DocumentView = load(() => import('@/components/industries/hepa/pages/DocumentView'))
const ReplacementView = load(() => import('@/components/industries/hepa/pages/ReplacementView'))
const WorkOrderView = load(() => import('@/components/industries/hepa/pages/WorkOrderView'))
const CleanroomView = load(() => import('@/components/industries/hepa/pages/CleanroomView'))
const WorkOrderCreate = load(() => import('@/components/industries/hepa/pages/WorkOrderCreate'))
const RequestView = load(() => import('@/components/industries/hepa/pages/RequestView'))
const InspectionView = load(() => import('@/components/industries/hepa/pages/InspectionView'))
const ReminderView = load(() => import('@/components/industries/hepa/pages/ReminderView'))
const IncidentView = load(() => import('@/components/industries/hepa/pages/IncidentView'))
const ChecklistView = load(() => import('@/components/industries/hepa/pages/ChecklistView'))
const InspectionCreate = load(() => import('@/components/industries/hepa/pages/InspectionCreate'))
const ChecklistCreate = load(() => import('@/components/industries/hepa/pages/ChecklistCreate'))
const RequestCreate = load(() => import('@/components/industries/hepa/pages/RequestCreate'))

const RECORD = {
  'filters': FilterView,
  // A leak reading and a SAP mapping are both about a filter and neither has
  // enough of its own to fill a page, so both open the filter's record — where
  // the reading sits beside the tests that say what it means.
  'leaks': FilterView,
  'sap-assets': FilterView,
  'sap-sync': FilterView,
  'tests': TestView,
  'repository': DocumentView,
  'retention': DocumentView,
  'approvals': DocumentView,
  'notifications': DocumentView,
  'lifecycle': DocumentView,
  'replacements': ReplacementView,
  'work-orders': WorkOrderView,
  // A PM schedule is the filter's own testing plan, so its row opens the
  // filter rather than a page that would only repeat what is already there.
  'pm-schedules': FilterView,
  'cleanrooms': CleanroomView,
  'requests': RequestView,
  'inspections': InspectionView,
  'inspection-reminder': ReminderView,
  'incidents': IncidentView,
  'checklists': ChecklistView,
}

// `new` is the one id that is not an id. Create lives on its own sub-route
// rather than behind a query flag, so it can be linked to and bookmarked — and
// a record page asked for a record called "new" would otherwise say it holds
// nothing with that reference, which is what a person typing the URL would get.
const CREATE = {
  'work-orders': WorkOrderCreate,
  // The product puts both of these on their own sub-route — /inspection/report/new
  // and /inspection/checklist/create — rather than behind a flag on the list.
  'inspections': InspectionCreate,
  'checklists': ChecklistCreate,
  // The QR code on the request register encodes this route. Without it the
  // code resolved to "no request called new", which is what a person scanning
  // it in a corridor would have got.
  'requests': RequestCreate,
}

export default function HepaRecord() {
  const { section, id } = useParams()

  if (id === 'new') {
    const Create = CREATE[section]
    return Create ? <Create section={section} /> : <NotHere section={section} id={id} />
  }

  const View = RECORD[section]
  return View
    ? <View section={section} id={decodeURIComponent(id)} />
    : <NotHere section={section} id={id} />
}

// Says which reference it could not find rather than a bare 404, because the
// usual way to land here is a stale link or a typed URL and the reference is
// the one thing worth showing back.
function NotHere({ section, id }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e4e9f0', borderRadius: 14,
      padding: '30px 26px', maxWidth: 560,
    }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Nothing here with that reference</h1>
      <p style={{ margin: '8px 0 0', fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
        <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{String(id)}</code> is not a record
        this portal holds under <strong>{String(section)}</strong>.
      </p>
      <a href={`/portal/hepa/${section}`} style={{
        display: 'inline-block', marginTop: 18, padding: '8px 14px',
        background: '#15227a', color: '#fff', borderRadius: 9,
        fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
      }}>Back to the list</a>
    </div>
  )
}
