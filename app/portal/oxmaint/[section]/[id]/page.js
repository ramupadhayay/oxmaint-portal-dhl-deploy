'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// One route for every record page in this portal: /portal/oxmaint/<section>/<id>.
//
// This portal had no record route at all, and a comment in its own code said so
// and treated it as settled: records opened in a drawer. That was a rule this
// portal invented, not one the product follows — the real Oxmaint opens a work
// order on its own page at /maintenance/work-orders/view/<id>, with a header, an
// action bar, a status control and nine tabs. None of that fits a 500px panel,
// and pretending it did is what made this portal read as a different product.
//
// The datacenter portal already resolves records this way, so the shape here is
// its shape: one dynamic segment, a map of the sections that have a page of
// their own, and nothing for the rest until they do.

// ssr: false for the same reason as the section pages: these records are dated
// relative to the demo clock, and server markup built on another clock is
// thrown away on hydration rather than reused.
const load = (fn) => dynamic(fn, { loading: () => <Skeleton />, ssr: false })

function Skeleton() {
  const bar = {
    background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)',
    backgroundSize: '400% 100%', animation: 'oxShim 1.1s ease-in-out infinite', borderRadius: 10,
  }
  return (
    <div className="max-w-8xl mx-auto p-6 space-y-4">
      <style>{'@keyframes oxShim{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
      <div style={{ ...bar, height: 20, width: 160 }} />
      <div style={{ ...bar, height: 34, width: '38%' }} />
      <div style={{ ...bar, height: 16, width: '52%' }} />
      <div style={{ ...bar, height: 320 }} />
    </div>
  )
}

const WorkOrderDetail = load(() => import('@/components/industries/oxmaint/pages/WorkOrderDetail'))
const AssetDetail = load(() => import('@/components/industries/oxmaint/pages/AssetDetail'))
const AssetForm = load(() => import('@/components/industries/oxmaint/pages/AssetForm'))
const PmScheduleDetail = load(() => import('@/components/industries/oxmaint/pages/PmScheduleDetail'))
const PurchaseOrderDetail = load(() => import('@/components/industries/oxmaint/pages/PurchaseOrderDetail'))
const RcmMode = load(() => import('@/components/industries/oxmaint/pages/RcmMode'))

const SECTIONS = {
  'work-orders': WorkOrderDetail,
  assets: AssetDetail,
  'pm-schedules': PmScheduleDetail,
  'purchase-orders': PurchaseOrderDetail,
  // A failure mode is a record like any other here: it has an address, it is
  // sent to people, and it does not fit a side panel.
  'rcm-reliability': RcmMode,
}

// `new` is a word, not an id. The product adds an asset at its own page rather
// than in a modal, and /assets/new is the address that reads as one — so the id
// segment answers to it before it goes looking for a record.
const NEW_FORMS = {
  assets: AssetForm,
}

export default function OxmaintRecord() {
  const { section, id } = useParams()

  if (id === 'new') {
    const Form = NEW_FORMS[section]
    if (Form) return <Form mode="add" />
  }

  const Page = SECTIONS[section]

  if (!Page) {
    return (
      <div className="max-w-8xl mx-auto p-6">
        <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
          <h3 className="font-semibold text-slate-800 mb-1">No record page for this section</h3>
          <p className="text-sm text-slate-500">
            Records in this section are read from its list screen.
          </p>
        </div>
      </div>
    )
  }
  return <Page />
}
