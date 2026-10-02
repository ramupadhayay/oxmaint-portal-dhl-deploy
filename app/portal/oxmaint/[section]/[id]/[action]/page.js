'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'

// The third segment: /portal/oxmaint/<section>/<id>/<action>.
//
// Only edit, so far. The product edits an asset at
// /assets/asset-master/edit/<id> rather than in a dialog, for the same reason it
// opens one on a page — a form with five sections is not a modal, and the fields
// a modal drops are the ones a register exists to hold.
//
// The id comes before the action here rather than after it, which is the one
// difference from the product's own URL. It keeps every record under one
// prefix — /assets/<id> and /assets/<id>/edit are the same record — so a section
// that grows a second action does not need a second route.

const load = (fn) => dynamic(fn, { loading: () => <Skeleton /> })

function Skeleton() {
  const bar = {
    background: 'linear-gradient(90deg,#eef1f5 25%,#f6f8fb 37%,#eef1f5 63%)',
    backgroundSize: '400% 100%', animation: 'oxShim 1.1s ease-in-out infinite', borderRadius: 10,
  }
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <style>{'@keyframes oxShim{0%{background-position:100% 0}100%{background-position:-100% 0}}'}</style>
      <div style={{ ...bar, height: 20, width: 160 }} />
      <div style={{ ...bar, height: 34, width: '38%' }} />
      <div style={{ ...bar, height: 220 }} />
      <div style={{ ...bar, height: 180 }} />
    </div>
  )
}

const AssetForm = load(() => import('@/components/industries/oxmaint/pages/AssetForm'))

const ACTIONS = {
  assets: { edit: AssetForm },
}

export default function OxmaintRecordAction() {
  const { section, action } = useParams()
  const Page = ACTIONS[section]?.[action]

  if (!Page) {
    return (
      <div className="max-w-8xl mx-auto p-6">
        <div className="bg-white border border-slate-200/60 rounded-lg shadow-sm p-12 text-center">
          <h3 className="font-semibold text-slate-800 mb-1">Nothing to do here</h3>
          <p className="text-sm text-slate-500">
            This section has no &ldquo;{action}&rdquo; screen.
          </p>
        </div>
      </div>
    )
  }
  return <Page mode={action} />
}
