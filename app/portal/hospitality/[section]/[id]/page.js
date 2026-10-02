'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// One route for every record page and every create form in the portal:
// /portal/hospitality/<section>/<id>.
//
// The alternative — a folder per register — would be a dozen near-identical
// route files whose only difference is which component they load. The FSM
// portal settled on this shape and it is the one followed here.
//
// Detail pages replace what used to be a side drawer. A drawer over a table is
// fine for four fields; these carry a suite's whole asset list, its checklist
// and its history, and a 470px panel sliding over the list is the wrong shape
// for that — it cannot be linked to, cannot be opened in a second tab, and the
// back button does not close it.

const load = (fn) => dynamic(fn, { loading: () => <Skeleton /> })

function Skeleton() {
  const bar = {
    background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)',
    backgroundSize: '400% 100%', animation: 'hospShim 1.1s ease-in-out infinite', borderRadius: 10,
  }
  return (
    <div>
      <style>{'@keyframes hospShim{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
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

// ── record pages ─────────────────────────────────────────────────────────
const SuiteView = load(() => import('@/components/industries/hospitality/pages/SuiteView'))
const AssetView = load(() => import('@/components/industries/hospitality/pages/AssetView'))
const WorkOrderView = load(() => import('@/components/industries/hospitality/pages/WorkOrderView'))
const RequestView = load(() => import('@/components/industries/hospitality/pages/RequestView'))
const IncidentView = load(() => import('@/components/industries/hospitality/pages/IncidentView'))
const ComponentView = load(() => import('@/components/industries/hospitality/pages/ComponentView'))

const RECORD = {
  'suites': SuiteView,
  'assets': AssetView,
  'work-orders': WorkOrderView,
  'requests': RequestView,
  'incidents': IncidentView,
  'common-areas': ComponentView,
}

// ── create forms ─────────────────────────────────────────────────────────
// `new` is the one id that is not an id. Create lives on its own sub-route
// rather than behind a query flag, so it can be linked to and bookmarked — and
// a record page asked for a record called "new" would otherwise render
// "nothing here with that reference", which is what a person typing the URL
// would get.
const WorkOrderCreate = load(() => import('@/components/industries/hospitality/pages/WorkOrderCreate'))
const RequestCreate = load(() => import('@/components/industries/hospitality/pages/RequestCreate'))
const ChecklistCreate = load(() => import('@/components/industries/hospitality/pages/ChecklistCreate'))

const CREATE = {
  'work-orders': WorkOrderCreate,
  'requests': RequestCreate,
  'checklists': ChecklistCreate,
}

export default function HospitalityRecord() {
  const { section, id } = useParams()

  if (id === 'new') {
    const Create = CREATE[section]
    return Create ? <Create section={section} /> : <NotHere section={section} id={id} />
  }

  const View = RECORD[section]
  return View ? <View section={section} id={decodeURIComponent(id)} /> : <NotHere section={section} id={id} />
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
      <a href={`/portal/hospitality/${section}`} style={{
        display: 'inline-block', marginTop: 18, padding: '8px 14px',
        background: '#15227a', color: '#fff', borderRadius: 9,
        fontSize: 12.5, fontWeight: 700, textDecoration: 'none',
      }}>Back to the list</a>
    </div>
  )
}
